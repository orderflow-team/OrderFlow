import Fuse from 'fuse.js';

/**
 * Turns what a cashier says ("do maggi aur ek doodh", "दो मैगी", "dolo 650")
 * into catalog items + quantities. Pure logic — no phone APIs — so it can be
 * tested directly. The hook in use-voice-order.ts only adds the microphone.
 */

export interface VoiceOrderProduct {
  id: string;
  name: string;
  selling_price: string | number;
  category?: string | null;
  unit?: string;
  barcode?: string | null;
  sku?: string | null;
  is_available?: boolean;
  stock_quantity?: number;
}

export interface ParsedVoiceItem {
  product: VoiceOrderProduct;
  quantity: number;
  rawQuery: string;
  matchScore: number;
  /** The product is marked out of stock. It is still added (a shop may sell beyond stock) but the UI warns. */
  outOfStock?: boolean;
}

/** Two or more products matched the spoken words equally well — the user should pick. */
export interface VoiceChoice {
  rawQuery: string;
  quantity: number;
  options: VoiceOrderProduct[];
}

export interface VoiceParseResult {
  /** Confident matches, ready to add to the cart. */
  items: ParsedVoiceItem[];
  /** Items that matched several products equally — the cashier must choose. */
  choices: VoiceChoice[];
  /** Spoken items nothing in the catalog matched (original wording, so Hindi shows as Hindi). */
  unmatched: string[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Devanagari → Latin. Android's Hindi recognizer (hi-IN) usually returns Hindi
 * words in Devanagari ("दो मैगी"), but the number words, filler words and product
 * names this parser knows are in Latin letters. Romanizing first lets one
 * pipeline handle both.
 * ──────────────────────────────────────────────────────────────────────────── */
const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'f', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh',
  ष: 'sh', स: 's', ह: 'h',
};
// A nukta (़) after these letters changes the sound.
const NUKTA: Record<string, string> = { ड: 'r', ढ: 'rh', ज: 'j', फ: 'f', क: 'k', ख: 'kh', ग: 'g' };
const INDEPENDENT_VOWELS: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o',
};
const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e',
};
const isDevanagariLetter = (ch: string | undefined) =>
  !!ch && (ch in CONSONANTS || ch in INDEPENDENT_VOWELS);

export function romanizeDevanagari(input: string): string {
  const text = input.normalize('NFD').replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch in CONSONANTS) {
      let sound = CONSONANTS[ch];
      if (text[i + 1] === '़') {
        sound = NUKTA[ch] ?? sound;
        i++;
      }
      out += sound;
      const next = text[i + 1];
      if (next && next in MATRAS) {
        out += MATRAS[next];
        i++;
      } else if (next === '्') {
        i++; // virama: no vowel after this consonant
      } else if (isDevanagariLetter(next)) {
        out += 'a'; // inherent vowel inside a word; a word-final one is silent ("namak", not "namaka")
      }
    } else if (ch in INDEPENDENT_VOWELS) {
      out += INDEPENDENT_VOWELS[ch];
    } else if (ch === 'ं' || ch === 'ँ') {
      out += 'n';
    } else if (ch === 'ः') {
      out += 'h';
    } else if (ch in MATRAS) {
      out += MATRAS[ch];
    } else if (ch !== '़' && ch !== '्') {
      out += ch;
    }
  }
  return out;
}

/**
 * Collapses the spelling differences between how the same sound gets written
 * (doodh/dudh, maggi/maigi, aadha/adha, chawal/chaval) so both sides of a
 * comparison — what was said, and product names — land on one form.
 */
export function phonetic(text: string): string {
  return text
    .toLowerCase()
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/ck/g, 'k')
    .replace(/w/g, 'v')
    .replace(/q/g, 'k')
    .replace(/z/g, 'j')
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/aa/g, 'a')
    .replace(/ai/g, 'a')
    .replace(/([bcdgjkpt])h/g, '$1') // aspirates: dh/th/bh/kh/gh/jh/ch
    .replace(/([a-z])\1+/g, '$1'); // double letters
}

/** Latin-letters form of whatever was heard, lowercase. */
const toLatin = (text: string) => romanizeDevanagari(text).toLowerCase();

/* ────────────────────────────────────────────────────────────────────────────
 * Vocabulary
 * ──────────────────────────────────────────────────────────────────────────── */
const NUMBER_WORDS_RAW: Record<string, number> = {
  ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, che: 6, chhah: 6, chah: 6, six: 6,
  saat: 7, seven: 7, aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10,
  gyarah: 11, barah: 12, aadha: 0.5, aadhi: 0.5, half: 0.5, dedh: 1.5, derh: 1.5, dhai: 2.5,
};
const NUMBER_WORDS: Record<string, number> = Object.fromEntries(
  Object.entries(NUMBER_WORDS_RAW).map(([word, value]) => [phonetic(word), value]),
);

// Single words spoken at the counter that are not part of a product name.
const FILLER_WORDS = new Set(
  [
    'packet', 'packets', 'pkt', 'pouch', 'pouches', 'bottle', 'bottles', 'strip', 'strips',
    'tablet', 'tablets', 'kilo', 'kg', 'gm', 'gram', 'grams', 'piece', 'pieces', 'pcs', 'dabba', 'box', 'boxes',
    'dedo', 'chahiye', 'chaiye', 'daalo', 'dalo', 'dena', 'dijiye', 'dijie', 'aur', 'bhi', 'ka', 'ki', 'ke',
    'bhaiya', 'bhai', 'please', 'mujhe', 'hume', 'humko',
  ].map(phonetic),
);

// Multi-word fillers. These used to sit in the single-word list, where they could never match.
const FILLER_PHRASES = /\b(?:de\s+do|dedo|de\s+dijiye|add\s+karo|kar\s+do|daal\s+do|dal\s+do|chahiye)\b/g;

// Words that split one sentence into separate items.
const SEPARATORS = /\s*(?:[,+\n]|(?:^|\s)(?:aur|and|fir|phir|plus|और|फिर|प्लस)(?=\s|$))\s*/i;

const NUMBER = /^\d+(?:\.\d+)?$/;

const quantityOf = (word: string | undefined): number | undefined => {
  if (!word) return undefined;
  if (NUMBER.test(word)) return parseFloat(word);
  return NUMBER_WORDS[phonetic(word)];
};

/* ────────────────────────────────────────────────────────────────────────────
 * Matching
 * ──────────────────────────────────────────────────────────────────────────── */
interface Indexed {
  product: VoiceOrderProduct;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  digits: Set<string>;
}

const digitRuns = (text: string) => new Set((text.match(/\d+(?:\.\d+)?/g) ?? []).map(String));

const MAX_ACCEPTED_SCORE = 0.5; // Fuse: 0 = perfect, 1 = nothing alike
const AMBIGUITY_GAP = 0.04; // runner-up this close to the best match = a genuine tie

export function parseVoiceOrder(spokenText: string, catalog: VoiceOrderProduct[]): VoiceParseResult {
  const result: VoiceParseResult = { items: [], choices: [], unmatched: [] };
  if (!spokenText || !spokenText.trim() || !catalog || catalog.length === 0) return result;

  const indexed: Indexed[] = catalog.map((product) => ({
    product,
    name: phonetic(product.name ?? ''),
    category: phonetic(product.category ?? ''),
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    digits: digitRuns((product.name ?? '').toLowerCase()),
  }));
  const catalogNumbers = new Set(indexed.flatMap((entry) => [...entry.digits]));

  const fuse = new Fuse(indexed, {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'category', weight: 0.15 },
      { name: 'sku', weight: 0.1 },
      { name: 'barcode', weight: 0.05 },
    ],
    threshold: MAX_ACCEPTED_SCORE, // flexible matching for phonetic approximations
    includeScore: true,
    minMatchCharLength: 2,
  });

  // A longer phrase scores worse against a name even when it is right, so a
  // hit is also accepted when the product's name contains a number the user
  // said ("maggi 70" → "Maggi Noodles 70g"): that is strong evidence on its own.
  const search = (query: string) => {
    const saidNumbers = query.split(/\s+/).filter((word) => NUMBER.test(word) && catalogNumbers.has(word));
    return fuse
      .search(phonetic(query), { limit: 6 })
      .filter(
        (hit) =>
          (hit.score ?? 1) <= MAX_ACCEPTED_SCORE ||
          saidNumbers.some((number) => hit.item.digits.has(number)),
      );
  };

  const segments = spokenText
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
    .split(SEPARATORS)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const tokens = toLatin(segment)
      .replace(FILLER_PHRASES, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => !FILLER_WORDS.has(phonetic(word)));
    if (tokens.length === 0) continue;

    // A number WORD at the very end is a quantity ("dolo 650 do", "maggi noodles do").
    // Taken off first so it can't pollute the product search. Digits are not
    // treated this way — a trailing digit is more likely part of a name ("dolo 650").
    let trailingQuantity: number | undefined;
    if (tokens.length >= 3 && quantityOf(tokens[0]) === undefined) {
      const last = tokens[tokens.length - 1];
      if (!NUMBER.test(last) && NUMBER_WORDS[phonetic(last)] !== undefined) {
        trailingQuantity = NUMBER_WORDS[phonetic(last)];
        tokens.pop();
      }
    }

    // Quantity: a number (or number word) as the first or second word.
    let quantity = 1;
    let quantityIndex = -1;
    if (quantityOf(tokens[0]) !== undefined) quantityIndex = 0;
    else if (tokens.length > 1 && quantityOf(tokens[1]) !== undefined) quantityIndex = 1;

    let query = tokens.join(' ');
    let hits: ReturnType<typeof search> = [];

    if (quantityIndex >= 0) {
      const spoken = tokens[quantityIndex];
      const asQuantity = quantityOf(spoken)!;
      const withoutNumber = tokens.filter((_, index) => index !== quantityIndex).join(' ');

      // "dolo 650" / "paracetamol 500" / "maggi 70": the number can be part of
      // the product's name, not a quantity. If it appears in the name of one of
      // the best matches for the full phrase, keep it in the name.
      // (Otherwise "dolo 650" used to add 650 strips of Dolo 650.)
      let usedAsName = false;
      if (NUMBER.test(spoken) && catalogNumbers.has(spoken)) {
        const named = search(tokens.join(' '));
        const withNumber = named.filter((hit) => hit.item.digits.has(spoken));
        if (withNumber[0] && (withNumber[0].score ?? 1) - (named[0].score ?? 1) <= 0.15) {
          hits = withNumber;
          query = tokens.join(' ');
          usedAsName = true;
        }
      }
      if (!usedAsName) {
        quantity = asQuantity;
        query = withoutNumber;
        hits = query ? search(query) : [];
      }
    } else {
      hits = search(query);
    }

    if (trailingQuantity !== undefined && quantity === 1) quantity = trailingQuantity;

    // Any size/strength the user actually said ("maggi 140") should win over a
    // fuzzy near-tie with another size.
    const saidNumbers = query.split(/\s+/).filter((word) => NUMBER.test(word) && catalogNumbers.has(word));
    if (saidNumbers.length > 0 && hits.length > 1) {
      const sized = hits.filter((hit) => saidNumbers.every((n) => hit.item.digits.has(n)));
      if (sized.length > 0) hits = sized;
    }

    if (!query.trim()) continue;

    if (hits.length === 0) {
      result.unmatched.push(segment);
      continue;
    }

    // Prefer an in-stock product when scores are effectively tied.
    const best = hits[0].score ?? 1;
    const tied = hits.filter((hit) => (hit.score ?? 1) - best <= AMBIGUITY_GAP);
    const exact = tied.find((hit) => phonetic(hit.item.product.name) === phonetic(query));
    const preferred = exact ?? tied.find((hit) => hit.item.product.is_available !== false) ?? hits[0];

    if (!exact && tied.length > 1) {
      // Same spoken words fit several products (Maggi 70g / Maggi 140g): don't guess.
      result.choices.push({
        rawQuery: segment,
        quantity: Math.max(0.1, quantity),
        options: tied.slice(0, 4).map((hit) => hit.item.product),
      });
      continue;
    }

    result.items.push({
      product: preferred.item.product,
      quantity: Math.max(0.1, quantity),
      rawQuery: segment,
      matchScore: 1 - (preferred.score ?? 1),
      ...(preferred.item.product.is_available === false ? { outOfStock: true } : {}),
    });
  }

  return result;
}

/** Confident matches only (what older callers expect). */
export function parseVoiceOrderText(spokenText: string, catalog: VoiceOrderProduct[]): ParsedVoiceItem[] {
  return parseVoiceOrder(spokenText, catalog).items;
}

import { describe, it, expect } from 'vitest';
import { parseVoiceOrder, parseVoiceOrderText, phonetic, romanizeDevanagari, type VoiceOrderProduct } from './voice-order-parser';

const product = (id: string, name: string, extra: Partial<VoiceOrderProduct> = {}): VoiceOrderProduct => ({
  id,
  name,
  selling_price: 10,
  ...extra,
});

const catalog: VoiceOrderProduct[] = [
  product('maggi70', 'Maggi Noodles 70g'),
  product('maggi140', 'Maggi Noodles 140g'),
  product('dolo', 'Dolo 650', { category: 'Medicine' }),
  product('para', 'Paracetamol 500', { category: 'Medicine' }),
  product('doodh', 'Amul Doodh 500ml'),
  product('chawal', 'Chawal Basmati'),
  product('salt', 'Tata Salt 1kg'),
  product('parle', 'Parle-G Biscuit', { is_available: false, stock_quantity: 0 }),
  product('namak', 'Sendha Namak'),
];

const summary = (text: string) => {
  const r = parseVoiceOrder(text, catalog);
  return {
    items: r.items.map((i) => `${i.quantity}x${i.product.id}`),
    choices: r.choices.map((c) => c.options.map((o) => o.id)),
    unmatched: r.unmatched,
  };
};

describe('quantity vs. numbers inside product names', () => {
  // These used to add 650 / 500 units: the second word was always read as the quantity.
  it('"dolo 650" is one Dolo 650, not 650 of them', () => {
    expect(summary('dolo 650').items).toEqual(['1xdolo']);
  });

  it('"paracetamol 500" is one Paracetamol 500', () => {
    expect(summary('paracetamol 500').items).toEqual(['1xpara']);
  });

  it('still reads a leading number as the quantity next to a numbered name', () => {
    expect(summary('2 dolo 650').items).toEqual(['2xdolo']);
    expect(summary('do dolo 650').items).toEqual(['2xdolo']);
  });

  it('reads a number that is in no product name as a quantity, in either position', () => {
    expect(summary('2 chawal').items).toEqual(['2xchawal']);
    expect(summary('chawal 2').items).toEqual(['2xchawal']);
  });

  it('takes a trailing number word as the quantity', () => {
    expect(summary('dolo 650 do').items).toEqual(['2xdolo']);
  });

  it('uses the number to pick the right size ("maggi 70")', () => {
    expect(summary('maggi 70').items).toEqual(['1xmaggi70']);
    expect(summary('3 maggi 140').items).toEqual(['3xmaggi140']);
  });
});

describe('Devanagari speech (what the hi-IN recognizer returns)', () => {
  it('romanizes common words', () => {
    expect(romanizeDevanagari('दो')).toBe('do');
    expect(romanizeDevanagari('एक')).toBe('ek');
    expect(romanizeDevanagari('नमक')).toBe('namak');
    expect(romanizeDevanagari('और')).toBe('aur');
    expect(romanizeDevanagari('१२')).toBe('12');
  });

  it('adds items said in Hindi script, with quantity words', () => {
    expect(summary('दो नमक').items).toEqual(['2xnamak']);
    expect(summary('आधा किलो चावल').items).toEqual(['0.5xchawal']);
  });

  it('splits Hindi-script items on और', () => {
    expect(summary('एक चावल और दो नमक').items).toEqual(['1xchawal', '2xnamak']);
  });

  it('matches a Hindi-script product name to its Latin catalog entry', () => {
    expect(summary('तीन दूध').items).toEqual(['3xdoodh']);
  });

  it('understands Devanagari digits', () => {
    expect(summary('२ नमक').items).toEqual(['2xnamak']);
  });
});

describe('filler phrases', () => {
  it('drops "de do" / "add karo" (they never matched as single words before)', () => {
    expect(summary('chawal de do').items).toEqual(['1xchawal']);
    expect(summary('do namak add karo').items).toEqual(['2xnamak']);
    expect(summary('दो नमक दे दो').items).toEqual(['2xnamak']);
  });
});

describe('things that could not be matched', () => {
  it('reports them instead of silently dropping them', () => {
    const r = summary('do namak aur cold drink');
    expect(r.items).toEqual(['2xnamak']);
    expect(r.unmatched).toEqual(['cold drink']);
  });

  it('reports Hindi-script items in the original script', () => {
    expect(parseVoiceOrder('एक चावल और बिल्कुल अनजान चीज़', catalog).unmatched).toEqual(['बिल्कुल अनजान चीज़']);
  });
});

describe('ambiguous matches', () => {
  it('asks instead of guessing when two products fit equally ("maggi")', () => {
    const r = summary('2 maggi');
    expect(r.items).toEqual([]);
    expect(r.choices).toHaveLength(1);
    expect(r.choices[0].sort()).toEqual(['maggi140', 'maggi70']);
  });

  it('keeps the spoken quantity on the pending choice', () => {
    expect(parseVoiceOrder('5 maggi', catalog).choices[0].quantity).toBe(5);
  });

  it('does not ask when the words fully name one product', () => {
    expect(summary('maggi noodles 70g').items).toEqual(['1xmaggi70']);
  });
});

describe('out-of-stock products', () => {
  it('still adds them, but flags them', () => {
    const r = parseVoiceOrder('teen parle g', catalog);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ quantity: 3, outOfStock: true });
    expect(r.items[0].product.id).toBe('parle');
  });
});

describe('behavior that already worked', () => {
  it('handles Hinglish sentences and half-quantities', () => {
    expect(summary('do namak aur ek chawal').items).toEqual(['2xnamak', '1xchawal']);
    expect(summary('aadha kilo chawal').items).toEqual(['0.5xchawal']);
  });

  it('returns nothing for empty input or an empty catalog', () => {
    expect(parseVoiceOrderText('', catalog)).toEqual([]);
    expect(parseVoiceOrderText('2 maggi', [])).toEqual([]);
  });

  it('parseVoiceOrderText returns only the confident items', () => {
    expect(parseVoiceOrderText('2 namak aur 2 maggi', catalog).map((i) => i.product.id)).toEqual(['namak']);
  });
});

describe('phonetic()', () => {
  it('maps different spellings of one sound to one form', () => {
    expect(phonetic('doodh')).toBe(phonetic('dudh'));
    expect(phonetic('maggi')).toBe(phonetic('maigee'));
    expect(phonetic('aadha')).toBe(phonetic('adha'));
    expect(phonetic('chawal')).toBe(phonetic('chaval'));
  });
});

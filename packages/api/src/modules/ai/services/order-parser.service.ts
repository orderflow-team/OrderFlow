import { Injectable, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import { ProductsService } from '../../products/products.service';
import { RestaurantService } from '../../restaurant/restaurant.service';
import { GeminiKeyPoolService } from '../../../common/services/gemini-key-pool.service';

@Injectable()
export class OrderParserService {
  constructor(
    private geminiKeyPool: GeminiKeyPoolService,
    private ordersService: OrdersService,
    private productsService: ProductsService,
    private restaurantService: RestaurantService,
  ) {}

  /**
   * Chat-based ordering: matches free-text item requests against the
   * business's real product catalog (so prices/names are trustworthy).
   * For restaurants, the customer can also say which table it's for
   * ("for table 3...") or "takeaway" explicitly; defaults to takeaway
   * (with a token number) when no table is mentioned or matched.
   *
   * An item that isn't on the menu is still added — seamlessly, same as the
   * New Order screen's free-text "Quick Parchi" quick-add
   * (findOrCreateProductFromCustomName in orders.service.ts) — at ₹0 (or the
   * stated total/quantity price) for the merchant to correct afterward. This
   * applies on both a brand-new order and an edit to an existing one, for
   * parity between the two. Editing can also reassign who the order is for,
   * by name and/or phone, when the customer explicitly asks — orders.service.ts's
   * replaceItems() reconciles the outstanding-balance ledger for the swap.
   */
  async parseChatOrder(businessId: string, message: string, orderId?: string) {
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    const [products, tables] = await Promise.all([
      this.productsService.findAll(businessId),
      this.restaurantService.findAllTables(businessId),
    ]);
    const available = products.filter((p) => p.is_available);

    if (available.length === 0) {
      return { reply: "You don't have any menu items set up yet — add some products first.", order: null };
    }

    const catalog = available.map((p) => `${p.name} (₹${Number(p.selling_price)})`).join(', ');
    const tableNames = tables.map((t) => t.name);

    let existingOrder: any = null;
    let currentItemsDesc = '';
    if (orderId) {
      existingOrder = await this.ordersService.findOne(orderId, businessId);
      if (existingOrder && existingOrder.items) {
        currentItemsDesc = existingOrder.items.map((i: any) => {
          const name = i.product?.name || i.custom_product_name || 'Unknown Item';
          return `${Number(i.quantity)}x "${name}"`;
        }).join(', ');
      }
    } else {
      // Deterministic regex parsing to detect if this is a direct edit command!
      let editTarget: { type: 'table' | 'token'; value: string | number } | null = null;
      let cleanMessage = message;

      const tokenRegex = /\b(?:token|tk|tok)\s*(\d+)\b/i;
      const tokenMatch = message.match(tokenRegex);
      if (tokenMatch) {
        editTarget = { type: 'token', value: Number(tokenMatch[1]) };
        cleanMessage = message.replace(tokenRegex, '').trim();
      } else {
        const tableRegex = /\b(?:table|t)\s*([a-zA-Z\d]+)\b/i;
        const tableMatch = message.match(tableRegex);
        if (tableMatch) {
          editTarget = { type: 'table', value: tableMatch[1] };
          cleanMessage = message.replace(tableRegex, '').trim();
        }
      }

      const hasModifyKeyword = /\b(add|remove|delete|plus|minus|change|cancel|extra)\b/i.test(cleanMessage);

      if (editTarget && hasModifyKeyword) {
        let resolvedOrderId: string | null = null;
        
        if (editTarget.type === 'table') {
          const tableName = String(editTarget.value).trim().toLowerCase();
          const table = tables.find((t) => {
            const name = t.name.toLowerCase();
            return name === tableName || 
                   name === `t${tableName}` || 
                   name === `table ${tableName}` ||
                   `t${name}` === tableName ||
                   `table ${name}` === tableName;
          });
          if (table) {
            const activeOrder = await this.ordersService.findActiveOrderByTable(table.id, businessId);
            if (activeOrder) {
              resolvedOrderId = activeOrder.id;
            } else {
              return {
                reply: `There is no active order for Table ${table.name} right now.`,
                order: null,
              };
            }
          } else {
            return {
              reply: `I couldn't find table "${editTarget.value}" to edit. Available tables: ${tableNames.join(', ') || 'none'}.`,
              order: null,
            };
          }
        } else if (editTarget.type === 'token') {
          const tokenNumber = Number(editTarget.value);
          const activeOrder = await this.ordersService.findActiveOrderByToken(tokenNumber, businessId);
          if (activeOrder) {
            resolvedOrderId = activeOrder.id;
          } else {
            return {
              reply: `There is no active order for Takeaway Token #${tokenNumber} right now.`,
              order: null,
            };
          }
        }

        if (resolvedOrderId) {
          // Recursively call parseChatOrder with the resolved order ID and the clean command!
          return this.parseChatOrder(businessId, cleanMessage, resolvedOrderId);
        }
      }
    }

    // For brand-new orders, pull out a customer name ("for Neel...") and a 10-digit
    // phone number up front — deterministically, regardless of whether the item list
    // itself ends up going through the fast path or Gemini below. Editing an existing
    // order never touches the customer on record, so this is skipped there.
    const contactInfo = existingOrder ? null : this.extractContactInfo(message);
    const itemMessage = contactInfo ? contactInfo.cleanMessage : message;

    let parsed: {
      matched: { menuName: string; quantity: number; unit?: string | null }[];
      unmatched: { name: string; quantity?: number; unit?: string | null; price?: number | null }[];
      orderType?: string;
      tableName?: string | null;
      customerName?: string | null;
      phone?: string | null;
    } | null = existingOrder ? null : this.tryDeterministicParse(itemMessage, available, tables);

    if (!parsed) {
      if (!this.geminiKeyPool.isConfigured) {
        throw new BadRequestException('Generative AI is not configured on the server. Please check the environment variables.');
      }

      let prompt = '';
      if (existingOrder) {
        prompt = `
          You are an ordering assistant editing an existing order for a shop.
          Here is the product catalog (case-insensitive): ${catalog}

          The current items in this order are: ${currentItemsDesc || 'None'}

          The customer is giving instructions to edit the order. They may want to:
          - Add new items — including items NOT on the menu (append to the order or increment quantity).
          - Remove items (delete them from the order completely).
          - Change quantity of items (update the count).
          - Replace items.
          - Change who the order is for (a new customer name, and/or a 10-digit phone number).

          Please interpret the customer's instruction: "${message}"

          Determine the FINAL COMPLETE list of matched items that should remain in the order. If an item was in the original order and was NOT requested to be removed or modified, KEEP it in the final list.

          If the customer mentions a unit for an item (e.g. "2kg rice", "3 packets of maggi", "1 dozen eggs",
          "500ml oil"), capture it in "unit" using their wording (kg, liter/litre, ml, piece, packet, tin, box,
          bag, dozen, etc.). If no unit is mentioned, use null — do not guess one.

          For an item that ISN'T on the menu (goes in "unmatched"), the customer may also state a price, e.g.
          "10kg mango 1000rs", "rs 1000", "₹1000", "1000 rupees" — if so, capture it in "price" as the TOTAL
          price they said for that item's whole quantity (not a per-unit price). If no price is stated, use
          null. Never invent a price. A price mentioned for an item that IS on the menu (goes in "matched") is
          never captured — the menu's own price always applies there.

          Only if the customer explicitly asked to change who the order is for (e.g. "this is for Priya now",
          "change customer to Neel", "set customer 9876543210"), capture that in "customerName" and/or "phone".
          Otherwise leave both null — never guess a customer change from ambiguous wording.

          Return ONLY JSON in this exact shape, no other text:
          {
            "matched": [{ "menuName": "exact name from the menu list above", "quantity": number, "unit": "string or null" }],
            "unmatched": [{ "name": "raw text for anything you couldn't confidently match", "quantity": number, "unit": "string or null", "price": "total price stated for this item, or null" }],
            "customerName": "string or null",
            "phone": "10-digit string or null"
          }
        `;
      } else {
        prompt = `
          You are an ordering assistant for a shop. The customer will describe what they want in plain
          English or Hinglish. Match each requested item to the closest item in this catalog (case-insensitive,
          ignore minor spelling differences): ${catalog}

          ${tableNames.length > 0 ? `This is a restaurant with these tables: ${tableNames.join(', ')}.
          The customer may say which table the order is for (e.g. "for table 3", "table T2") or say
          "takeaway"/"take away"/"to go". If a table is mentioned, set orderType to "dine_in" and tableName
          to the exact matching name from the list above. If takeaway is mentioned or no table is mentioned
          at all, set orderType to "take_away" and tableName to null.` : 'This shop has no tables — always set orderType to "take_away" and tableName to null.'}

          If the customer mentions a unit for an item (e.g. "2kg rice", "3 packets of maggi", "1 dozen eggs",
          "500ml oil"), capture it in "unit" using their wording (kg, liter/litre, ml, piece, packet, tin, box,
          bag, dozen, etc.). If no unit is mentioned, use null — do not guess one.

          For an item that ISN'T on the menu (goes in "unmatched"), the customer may also state a price, e.g.
          "10kg mango 1000rs", "rs 1000", "₹1000", "1000 rupees" — if so, capture it in "price" as the TOTAL
          price they said for that item's whole quantity (not a per-unit price; e.g. "10kg mango 1000rs" means
          price: 1000 for quantity: 10, NOT price: 1000 per kg). A trailing number+"rs"/"rupees"/"₹" is ALWAYS
          the price of the item right before it — it is never a separate item on its own. For example,
          "10kg mango 1000rs" is ONE unmatched entry: { "name": "mango", "quantity": 10, "unit": "kg", "price":
          1000 } — never two entries where "1000rs" becomes its own item. If no price is stated, use null. Never
          invent a price. A price mentioned for an item that IS on the menu (goes in "matched") is never
          captured — the menu's own price always applies there, so "matched" has no price field at all.

          Customer message: "${itemMessage}"

          Return ONLY JSON in this exact shape, no other text:
          {
            "matched": [{ "menuName": "exact name from the menu list above", "quantity": number, "unit": "string or null" }],
            "unmatched": [{ "name": "raw text for anything you couldn't confidently match", "quantity": number, "unit": "string or null", "price": "total price stated for this item, or null" }],
            "orderType": "dine_in" | "take_away",
            "tableName": "exact table name from the list above, or null"
          }
        `;
      }

      try {
        const text = await this.geminiKeyPool.generateContent('gemini-2.5-flash', [prompt]);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in model response');
        parsed = JSON.parse(jsonMatch[0]);
      } catch (error) {
        throw new BadRequestException(`Could not understand the order: ${error.message}`);
      }
    }

    const matchedItems = (parsed.matched || [])
      .map((m) => {
        const product = available.find((p) => p.name.toLowerCase() === m.menuName?.toLowerCase());
        return product
          ? { productId: product.id, quantity: Number(m.quantity) || 1, unit: m.unit || undefined }
          : null;
      })
      .filter((i): i is { productId: string; quantity: number; unit: string | undefined } => i !== null);

    const fmtQty = (quantity: number, unit?: string) => (unit ? `${quantity} ${unit}` : `${quantity}x`);

    // Anything not on the menu still gets ordered — same seamless quick-add the
    // New Order screen's free-text flow already does, whether this is a brand-new
    // order or an edit. If the customer stated a price for it (a TOTAL for the
    // whole quantity, e.g. "10kg mango 1000rs"), use price/quantity as the unit
    // price; otherwise ₹0 for the merchant to set afterward.
    // findOrCreateProductFromCustomName (orders.service.ts) creates the Product
    // row the first time each name is used.
    const newItems = (parsed.unmatched || [])
      .filter((u) => u && typeof u.name === 'string' && u.name.trim().length > 0)
      .map((u) => {
        const quantity = Number(u.quantity) || 1;
        const statedTotal = u.price != null && !isNaN(Number(u.price)) ? Number(u.price) : null;
        return {
          customProductName: u.name.trim(),
          quantity,
          unitPrice: statedTotal !== null ? statedTotal / quantity : 0,
          unit: u.unit || undefined,
        };
      });

    if (existingOrder) {
      const originalCount = existingOrder.items?.length || 0;
      const lowerMsg = message.toLowerCase();
      const hasClearIntent = lowerMsg.includes('remove all') ||
                             lowerMsg.includes('clear') ||
                             lowerMsg.includes('delete all') ||
                             lowerMsg.includes('empty') ||
                             lowerMsg.includes('cancel');

      if (matchedItems.length === 0 && newItems.length === 0 && originalCount > 0 && !hasClearIntent) {
        return {
          reply: `I couldn't understand what you wanted to change. The items in Order #${existingOrder.order_number} remain unchanged. Try saying "add 2 cokes" or "remove milk".`,
          order: existingOrder,
        };
      }

      const editItems = [...matchedItems, ...newItems];
      const updatedOrder = await this.ordersService.replaceItems(orderId!, businessId, {
        items: editItems,
        customerName: parsed.customerName || undefined,
        phone: parsed.phone || undefined,
      });

      const matchedSummary = matchedItems
        .map((i) => {
          const product = available.find((p) => p.id === i.productId)!;
          return `${fmtQty(i.quantity, i.unit)} ${product.name}`;
        })
        .join(', ');
      const newSummary = newItems
        .map((i) => `${fmtQty(i.quantity, i.unit)} ${i.customProductName} (new)`)
        .join(', ');
      const summary = [matchedSummary, newSummary].filter(Boolean).join(', ');

      const customerNote = parsed.customerName ? ` Now for ${updatedOrder.customer_name}.` : '';

      return {
        reply: `Order #${updatedOrder.order_number} updated!${customerNote} Items: ${summary || 'None'}.`,
        order: updatedOrder,
      };
    }

    const allItems: Array<{ productId?: string; customProductName?: string; quantity: number; unitPrice?: number; unit?: string }> = [
      ...matchedItems,
      ...newItems,
    ];

    if (allItems.length === 0) {
      return {
        reply: `I couldn't match that to anything on the menu. Could you try naming an item directly? Available: ${available.map((p) => p.name).join(', ')}`,
        order: null,
      };
    }

    const wantsDineIn = parsed.orderType === 'dine_in' && !!parsed.tableName;
    const table = wantsDineIn
      ? tables.find((t) => t.name.toLowerCase() === parsed.tableName!.toLowerCase())
      : undefined;

    if (wantsDineIn && !table) {
      return {
        reply: `I couldn't find table "${parsed.tableName}". Available tables: ${tableNames.join(', ') || 'none'}. Say "takeaway" if this isn't for a table.`,
        order: null,
      };
    }

    const order = await this.ordersService.create({
      businessId,
      customerName: table ? `Table ${table.name}` : contactInfo?.customerName || 'Chat Order',
      phone: contactInfo?.phone || undefined,
      orderType: table ? 'dine_in' : 'take_away',
      tableId: table?.id,
      items: allItems,
    } as any);

    const matchedSummary = matchedItems
      .map((i) => {
        const product = available.find((p) => p.id === i.productId)!;
        return `${fmtQty(i.quantity, i.unit)} ${product.name}`;
      })
      .join(', ');

    const newSummary = newItems
      .map((i) => {
        const priceNote = i.unitPrice > 0 ? `new, ₹${i.unitPrice.toFixed(2)}${i.unit ? `/${i.unit}` : ' each'}` : 'new, ₹0 — set its price';
        return `${fmtQty(i.quantity, i.unit)} ${i.customProductName} (${priceNote})`;
      })
      .join(', ');

    const summary = [matchedSummary, newSummary].filter(Boolean).join(', ');

    const placementNote = table ? `for Table ${table.name}` : `— Token #${order.token_number}`;
    const namePart = contactInfo?.customerName ? ` for ${contactInfo.customerName}` : '';

    return {
      reply: `Order placed${namePart}! ${summary} ${placementNote}.`,
      order,
    };
  }

  // Longer/more-specific unit words are listed before their single-letter shorthand
  // (e.g. "liters?" before "l") — regex alternation takes the first branch that
  // matches, so "l" alone would otherwise win against "4liter" and strand "iter"
  // in the item name.
  private static readonly UNIT_WORDS =
    'kilograms?|kg|litres?|liters?|ltrs?|l|grams?|g|ml|pieces?|pcs?|packets?|pkts?|tins?|boxe?s?|bags?|dozens?';

  // Words that could otherwise get swept into the leading "<name> order ..."
  // capture below via greedy backtracking — e.g. "Make Neel order 2 rice" should
  // yield the name "Neel", not "Make Neel".
  private static readonly NAME_STOPWORDS = new Set([
    'make', 'create', 'place', 'please', 'order', 'new', 'the', 'a', 'an',
    'this', 'that', 'my', 'quick', 'table', 'kindly', 'hi', 'hello', 'hey',
  ]);

  /**
   * Pulls a customer name and/or 10-digit phone number out of a brand-new chat
   * order message, e.g. "Neel order 2kg rice 4liter milk" or "make a order for
   * the neel 3kg rice 9876543210" — deterministically, so this works whether the
   * item list itself ends up going through the fast path below or falls through
   * to Gemini. Only fires on two unambiguous shapes ("<name> order ..." leading,
   * or "for [the] <name> ..." trailing), each immediately followed by a quantity
   * digit, and a standalone 10-digit run for the phone; anything less clear-cut
   * is simply left alone (no name/phone captured) rather than guessed — a miss
   * here just costs a defaulted "Chat Order" name, never a misplaced item.
   */
  private extractContactInfo(message: string): { customerName: string | null; phone: string | null; cleanMessage: string } {
    let text = message.trim();

    text = text.replace(/^(?:please\s+)?(?:make|create|place)\s+(?:a|an)\s+order\s*/i, '').trim();

    let phone: string | null = null;
    const phoneMatch = text.match(/\b(\d{10})\b/);
    if (phoneMatch && phoneMatch.index !== undefined) {
      phone = phoneMatch[1];
      text = (text.slice(0, phoneMatch.index) + ' ' + text.slice(phoneMatch.index + phoneMatch[0].length)).trim();
    }

    const titleCase = (raw: string) =>
      raw.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    let customerName: string | null = null;

    // "Neel order 2kg rice..." / "Neel's order for 3kg rice..." — name leads,
    // immediately followed by the word "order" itself.
    const leadingMatch = text.match(/^([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})(?:'s)?\s+order\b(?:\s+for)?[\s,]*(?=\d)/i);
    const leadingWords = leadingMatch ? leadingMatch[1].trim().split(/\s+/) : [];
    if (leadingMatch && !leadingWords.some((w) => OrderParserService.NAME_STOPWORDS.has(w.toLowerCase()))) {
      customerName = titleCase(leadingMatch[1]);
      text = text.slice(leadingMatch[0].length).trim();
    } else {
      // "order for [the] Neel..." — name trails "for". "table" is excluded so
      // "for table 3..." isn't mistaken for a customer named Table — that phrase
      // is handled separately by the dine-in table detection.
      const nameMatch = text.match(/\b(?:order\s+)?for\s+(?:the\s+)?(?!table\b)([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})(?=[\s,]*\d)/i);
      if (nameMatch && nameMatch.index !== undefined) {
        customerName = titleCase(nameMatch[1]);
        text = (text.slice(0, nameMatch.index) + ' ' + text.slice(nameMatch.index + nameMatch[0].length)).trim();
      }
    }

    return { customerName, phone, cleanMessage: text.replace(/\s+/g, ' ').trim() };
  }

  /**
   * Splits a segment-less message (no comma/"and"/"&") into per-item chunks by
   * cutting right before each fresh quantity digit, e.g. "3kg rice 4liter milk
   * 3pkts cookies" -> ["3kg rice", "4liter milk", "3pkts cookies"]. A trailing
   * stated price (e.g. "10kg mango 1000rs") is set aside first and reattached to
   * the last chunk, so a single priced item isn't mistaken for two items — the
   * price digits themselves would otherwise look like a second item's quantity.
   */
  private splitImplicitSegments(text: string): string[] {
    let trailingPrice = '';
    let body = text;
    const priceMatch = text.match(
      /(?:₹\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:rs\.?|rupees?)|rs\.?\s*\d+(?:\.\d+)?)\s*$/i,
    );
    if (priceMatch && priceMatch.index !== undefined) {
      trailingPrice = priceMatch[0].trim();
      body = text.slice(0, priceMatch.index).trim();
    }

    const chunks = body.match(/\d+(?:\.\d+)?[^\d]*/g);
    if (!chunks || chunks.length <= 1) return [text];

    const lastIndex = chunks.length - 1;
    return chunks
      .map((chunk, i) => (i === lastIndex ? `${chunk.trim()} ${trailingPrice}`.trim() : chunk.trim()))
      .filter(Boolean);
  }

  /**
   * Tries to resolve a brand-new order's message without spending a Gemini call —
   * Gemini's free tier is rate/quota-limited, so a message this simple (single or
   * comma/"and"-separated items, each a clean "[qty][unit]? name [price]?" shape)
   * shouldn't need it. Deliberately conservative: any segment that doesn't parse
   * cleanly, or resolves to more than one plausible catalog match, returns null for
   * the WHOLE message rather than guess — parseChatOrder then falls through to
   * Gemini exactly as before. A wrong confident guess here would misplace a real
   * order; a missed fast-path just costs one Gemini call.
   */
  private tryDeterministicParse(
    message: string,
    available: any[],
    tables: any[],
  ): {
    matched: { menuName: string; quantity: number; unit?: string | null }[];
    unmatched: { name: string; quantity?: number; unit?: string | null; price?: number | null }[];
    orderType: string;
    tableName: string | null;
  } | null {
    let text = message.trim();
    let orderType = 'take_away';
    let tableName: string | null = null;

    if (tables.length > 0) {
      const tableMatch = text.match(/\b(?:for\s+)?table\s*([a-zA-Z0-9]+)\b/i);
      if (tableMatch) {
        const raw = tableMatch[1].trim().toLowerCase();
        const table = tables.find((t) => {
          const name = t.name.toLowerCase();
          return name === raw || name === `t${raw}` || `t${name}` === raw;
        });
        if (!table) return null; // ambiguous table reference — let Gemini give a proper error
        orderType = 'dine_in';
        tableName = table.name;
        text = text.replace(tableMatch[0], ' ').trim();
      } else {
        text = text.replace(/\b(?:takeaway|take\s*away|to\s*go)\b/i, ' ').trim();
      }
    }

    const segments = /[,&]|\band\b/i.test(text)
      ? text
          .split(/\s*(?:,|\band\b|&)\s*/i)
          .map((s) => s.trim())
          .filter(Boolean)
      : this.splitImplicitSegments(text).map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) return null;

    const matched: { menuName: string; quantity: number; unit?: string | null }[] = [];
    const unmatched: { name: string; quantity?: number; unit?: string | null; price?: number | null }[] = [];

    for (const segment of segments) {
      const item = this.parseSegment(segment);
      if (!item) return null; // not a clean/simple enough segment — bail to Gemini

      const normalized = item.name.toLowerCase();
      const exact = available.find((p) => p.name.trim().toLowerCase() === normalized);
      if (exact) {
        matched.push({ menuName: exact.name, quantity: item.quantity, unit: item.unit });
        continue;
      }

      // "e2e test snack" should still find "E2E Test Snack 100g" — same substring
      // tier invoice-scan.service.ts's fuzzy matcher uses, kept independent here
      // rather than shared so this feature can't regress that already-verified one.
      const substringMatches = available.filter((p) => {
        const pname = p.name.trim().toLowerCase();
        if (Math.min(pname.length, normalized.length) < 4) return false;
        return normalized.includes(pname) || pname.includes(normalized);
      });
      if (substringMatches.length > 1) return null; // ambiguous — let Gemini sort it out
      if (substringMatches.length === 1) {
        matched.push({ menuName: substringMatches[0].name, quantity: item.quantity, unit: item.unit });
        continue;
      }

      const fuzzyMatches = available.filter((p) => {
        const pname = p.name.trim().toLowerCase();
        if (Math.max(pname.length, normalized.length) < 6) return false;
        return this.levenshteinDistance(pname, normalized) <= 2;
      });
      if (fuzzyMatches.length > 1) return null; // ambiguous fuzzy match — let Gemini sort it out
      if (fuzzyMatches.length === 1) {
        matched.push({ menuName: fuzzyMatches[0].name, quantity: item.quantity, unit: item.unit });
        continue;
      }

      unmatched.push({ name: item.name, quantity: item.quantity, unit: item.unit, price: item.price });
    }

    return { matched, unmatched, orderType, tableName };
  }

  /** One "[qty][unit]? name [price]?" segment, e.g. "10kg mango 1000rs" or "2 rice". */
  private parseSegment(segment: string): { name: string; quantity: number; unit?: string; price: number | null } | null {
    let text = segment.trim();
    if (!text) return null;

    let price: number | null = null;
    const priceMatch = text.match(
      /(?:₹\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?)|rs\.?\s*(\d+(?:\.\d+)?))\s*$/i,
    );
    if (priceMatch) {
      price = Number(priceMatch[1] ?? priceMatch[2] ?? priceMatch[3]);
      text = text.slice(0, priceMatch.index).trim();
    }

    let quantity = 1;
    let unit: string | undefined;
    const qtyMatch = text.match(
      new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${OrderParserService.UNIT_WORDS})?\\.?\\s*(?:of\\s+)?`, 'i'),
    );
    if (qtyMatch) {
      quantity = Number(qtyMatch[1]);
      unit = qtyMatch[2] ? qtyMatch[2].toLowerCase() : undefined;
      text = text.slice(qtyMatch[0].length).trim();
    }

    const name = text.trim();
    if (!name) return null;

    // Confidence guard: a clean name shouldn't have a standalone number or a
    // number+unit token like "2kg" left in it — that's a quantity we failed to
    // pull out (e.g. a trailing "rice 2kg" our qty regex is leading-only and
    // doesn't catch), not part of the product name. Product names WITH digits in
    // them (e2e, 7up, v8) are fine and shouldn't be rejected just for that.
    const strayQtyToken = new RegExp(`^\\d+(?:\\.\\d+)?(?:${OrderParserService.UNIT_WORDS})?$`, 'i');
    if (name.split(/\s+/).some((word) => strayQtyToken.test(word))) return null;

    return { name, quantity, unit, price };
  }

  private levenshteinDistance(a: string, b: string): number {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;
    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  /**
   * Parse voice transcript to order draft
   * BUILT FROM SCRATCH for OrderFlow
   * NOT copied from Wholesale Admin
   */
  async parseVoiceTranscript(
    transcript: string,
    businessId: string,
    customerId: string,
  ) {
    // Step 1: Validate input
    if (!transcript || transcript.trim().length === 0) {
      throw new BadRequestException('Transcript cannot be empty');
    }

    // Step 2: Extract order structure from transcript
    const extracted = await this.extractOrderStructure(transcript);

    // Step 3: Return order draft
    return {
      customerName: extracted.customer_name || 'Unknown Customer',
      customerId: customerId,
      items: extracted.items || [],
      status: 'draft',
      totalAmount: 0, // Will be calculated in Phase 2
    };
  }

  /**
   * Extract structure from Hinglish transcript using Gemini
   */
  private async extractOrderStructure(transcript: string) {
    if (!this.geminiKeyPool.isConfigured) {
      throw new BadRequestException('Generative AI is not configured on the server. Please check the environment variables.');
    }

    const prompt = `
      You are a Hindi-English voice order parser for OrderFlow wholesale platform.
      Parse the following voice transcript and extract customer name and ordered items.
      
      RULES:
      1. Customer name is usually mentioned first or at end
      2. Items can be in Hindi, English, or Hinglish
      3. Quantities can use Indian units: kg, liter, piece, packet, tin, box, bag
      4. Extract ONLY customer name and items
      5. If customer name unclear, use "Unknown Customer"
      6. Return ONLY valid JSON, no other text
      
      Transcript: "${transcript}"
      
      Return JSON format:
      {
        "customer_name": "string",
        "items": [
          {
            "name": "string (product name)",
            "quantity": number,
            "unit": "string"
          }
        ]
      }
      
      Return ONLY JSON:
    `;

    try {
      const text = await this.geminiKeyPool.generateContent('gemini-flash-latest', [prompt]);

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new BadRequestException('Could not parse voice transcript');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error) {
      throw new BadRequestException(
        `Voice parsing failed: ${error.message}`,
      );
    }
  }
}

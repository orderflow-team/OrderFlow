import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../../orders/orders.service';
import { ProductsService } from '../../products/products.service';
import { RestaurantService } from '../../restaurant/restaurant.service';

@Injectable()
export class OrderParserService {
  private genAI: GoogleGenerativeAI;

  constructor(
    private configService: ConfigService,
    private ordersService: OrdersService,
    private productsService: ProductsService,
    private restaurantService: RestaurantService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey && apiKey !== 'test-key') {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('GEMINI_API_KEY is not configured or is set to test-key. AI services will be unavailable.');
    }
  }

  /**
   * Chat-based ordering: matches free-text item requests against the
   * business's real product catalog (so prices/names are trustworthy).
   * For restaurants, the customer can also say which table it's for
   * ("for table 3...") or "takeaway" explicitly; defaults to takeaway
   * (with a token number) when no table is mentioned or matched.
   *
   * On a brand-new order, an item that isn't on the menu is still added —
   * seamlessly, same as the New Order screen's free-text "Quick Parchi" quick-add
   * (findOrCreateProductFromCustomName in orders.service.ts) — at ₹0 for the
   * merchant to correct afterward, since there's no price to trust yet. When
   * editing an existing order, "unmatched" stays a reported note instead: there
   * the model's failure to match can just as easily mean a misread edit/removal
   * instruction as a genuinely new item, and auto-creating a product from a
   * misunderstood "remove X" would be the wrong call.
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

    if (!this.genAI) {
      throw new BadRequestException('Generative AI is not configured on the server. Please check the environment variables.');
    }
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = '';
    if (existingOrder) {
      prompt = `
        You are an ordering assistant editing an existing order for a shop.
        Here is the product catalog (case-insensitive): ${catalog}

        The current items in this order are: ${currentItemsDesc || 'None'}

        The customer is giving instructions to edit the order. They may want to:
        - Add new items (append to the order or increment quantity).
        - Remove items (delete them from the order completely).
        - Change quantity of items (update the count).
        - Replace items.

        Please interpret the customer's instruction: "${message}"

        Determine the FINAL COMPLETE list of matched items that should remain in the order. If an item was in the original order and was NOT requested to be removed or modified, KEEP it in the final list.

        If the customer mentions a unit for an item (e.g. "2kg rice", "3 packets of maggi", "1 dozen eggs",
        "500ml oil"), capture it in "unit" using their wording (kg, liter/litre, ml, piece, packet, tin, box,
        bag, dozen, etc.). If no unit is mentioned, use null — do not guess one.

        Return ONLY JSON in this exact shape, no other text:
        {
          "matched": [{ "menuName": "exact name from the menu list above", "quantity": number, "unit": "string or null" }],
          "unmatched": [{ "name": "raw text for anything you couldn't confidently match", "quantity": number, "unit": "string or null" }]
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
        price: 1000 for quantity: 10, NOT price: 1000 per kg). If no price is stated, use null. Never invent a
        price. A price mentioned for an item that IS on the menu (goes in "matched") is never captured — the
        menu's own price always applies there, so "matched" has no price field at all.

        Customer message: "${message}"

        Return ONLY JSON in this exact shape, no other text:
        {
          "matched": [{ "menuName": "exact name from the menu list above", "quantity": number, "unit": "string or null" }],
          "unmatched": [{ "name": "raw text for anything you couldn't confidently match", "quantity": number, "unit": "string or null", "price": "total price stated for this item, or null" }],
          "orderType": "dine_in" | "take_away",
          "tableName": "exact table name from the list above, or null"
        }
      `;
    }

    let parsed: {
      matched: { menuName: string; quantity: number; unit?: string | null }[];
      unmatched: { name: string; quantity?: number; unit?: string | null; price?: number | null }[];
      orderType?: string;
      tableName?: string | null;
    };
    try {
      const text = await this.generateWithRetry(model, prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in model response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new BadRequestException(`Could not understand the order: ${error.message}`);
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

    if (existingOrder) {
      const originalCount = existingOrder.items?.length || 0;
      const lowerMsg = message.toLowerCase();
      const hasClearIntent = lowerMsg.includes('remove all') ||
                             lowerMsg.includes('clear') ||
                             lowerMsg.includes('delete all') ||
                             lowerMsg.includes('empty') ||
                             lowerMsg.includes('cancel');

      if (matchedItems.length === 0 && originalCount > 0 && !hasClearIntent) {
        const unmatchedNote = parsed.unmatched?.length
          ? ` (couldn't match: ${parsed.unmatched.map((u) => u.name).join(', ')})`
          : '';
        return {
          reply: `I couldn't understand what you wanted to change${unmatchedNote}. The items in Order #${existingOrder.order_number} remain unchanged. Try saying "add 2 cokes" or "remove milk".`,
          order: existingOrder,
        };
      }

      const updatedOrder = await this.ordersService.replaceItems(orderId!, businessId, { items: matchedItems });

      const summary = matchedItems
        .map((i) => {
          const product = available.find((p) => p.id === i.productId)!;
          return `${fmtQty(i.quantity, i.unit)} ${product.name}`;
        })
        .join(', ');

      const unmatchedNote = parsed.unmatched?.length
        ? ` (couldn't match: ${parsed.unmatched.map((u) => u.name).join(', ')})`
        : '';

      return {
        reply: `Order #${updatedOrder.order_number} updated! New items: ${summary || 'None'}.${unmatchedNote}`,
        order: updatedOrder,
      };
    }

    // Anything not on the menu still gets ordered — same seamless quick-add the
    // New Order screen's free-text flow already does. If the customer stated a
    // price for it (a TOTAL for the whole quantity, e.g. "10kg mango 1000rs"),
    // use price/quantity as the unit price; otherwise ₹0 for the merchant to set
    // afterward. findOrCreateProductFromCustomName (orders.service.ts) creates
    // the Product row the first time each name is used.
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
      customerName: table ? `Table ${table.name}` : 'Chat Order',
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

    return {
      reply: `Order placed! ${summary} ${placementNote}.`,
      order,
    };
  }

  /** Gemini's free tier intermittently returns 503 "high demand" — worth a couple of quick retries. */
  private async generateWithRetry(model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>, prompt: string, attempts = 3) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded');
        if (!isOverloaded || attempt === attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    throw new Error('Unreachable');
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
    if (!this.genAI) {
      throw new BadRequestException('Generative AI is not configured on the server. Please check the environment variables.');
    }
    const model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

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
      const result = await model.generateContent(prompt);
      const text = result.response.text();

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

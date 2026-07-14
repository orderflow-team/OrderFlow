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
   * Unmatched items are surfaced back to the user instead of guessing a price.
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

        Return ONLY JSON in this exact shape, no other text:
        {
          "matched": [{ "menuName": "exact name from the menu list above", "quantity": number }],
          "unmatched": ["raw text for anything you couldn't confidently match"]
        }
      `;
    } else {
      prompt = `
        You are an ordering assistant for a shop. The customer will describe what they want in plain
        English or Hinglish.
        
        They might want to place a NEW order (e.g. "2 cokes", "for table 3 get a pizza"), or they might
        want to EDIT an existing active order by referencing a table name or a takeaway token number
        (e.g. "add t4 4 chai", "token 3 add 3 lassi", "remove table 2 1 coffee", "table 3 add sprite").

        First, determine if the message is instructing to edit an existing order by mentioning a table
        or token number. 
        - If they mention a table name (from the list below) or a token number AND they use modification words
          like "add", "remove", "change", "delete", "extra", then set "isEditMode" to true.
        - Otherwise, set "isEditMode" to false.

        Available tables in this restaurant: ${tableNames.join(', ') || 'None'}
        Available catalog items: ${catalog}

        Return ONLY JSON in this exact shape, no other text:
        {
          "isEditMode": boolean,
          
          // Only populated if isEditMode is true:
          "editTarget": {
            "type": "table" | "token",
            "value": "exact table name (string) from list above OR token number (number)"
          } | null,
          "editInstruction": "clean message for the edit action, e.g. 'add 4 chai' or 'remove 1 coffee'",

          // Only populated if isEditMode is false:
          "matched": [{ "menuName": "exact name from the menu list above", "quantity": number }],
          "unmatched": ["raw text for anything you couldn't confidently match"],
          "orderType": "dine_in" | "take_away",
          "tableName": "exact table name from the list above, or null"
        }
      `;
    }

    let parsed: {
      isEditMode?: boolean;
      editTarget?: {
        type: 'table' | 'token';
        value: string | number;
      } | null;
      editInstruction?: string;

      matched: { menuName: string; quantity: number }[];
      unmatched: string[];
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

    if (!existingOrder && parsed.isEditMode && parsed.editTarget) {
      let resolvedOrderId: string | null = null;
      if (parsed.editTarget.type === 'table') {
        const tableName = String(parsed.editTarget.value).trim();
        const table = tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
        if (!table) {
          return {
            reply: `I couldn't find table "${tableName}" to edit. Available tables: ${tableNames.join(', ') || 'none'}.`,
            order: null,
          };
        }
        const activeOrder = await this.ordersService.findActiveOrderByTable(table.id, businessId);
        if (!activeOrder) {
          return {
            reply: `There is no active order for Table ${table.name} right now.`,
            order: null,
          };
        }
        resolvedOrderId = activeOrder.id;
      } else if (parsed.editTarget.type === 'token') {
        const tokenNumber = Number(parsed.editTarget.value);
        if (isNaN(tokenNumber)) {
          return {
            reply: `Invalid token number "${parsed.editTarget.value}".`,
            order: null,
          };
        }
        const activeOrder = await this.ordersService.findActiveOrderByToken(tokenNumber, businessId);
        if (!activeOrder) {
          return {
            reply: `There is no active order for Takeaway Token #${tokenNumber} right now.`,
            order: null,
          };
        }
        resolvedOrderId = activeOrder.id;
      }

      if (resolvedOrderId) {
        return this.parseChatOrder(businessId, parsed.editInstruction || message, resolvedOrderId);
      }
    }

    const matchedItems = (parsed.matched || [])
      .map((m) => {
        const product = available.find((p) => p.name.toLowerCase() === m.menuName?.toLowerCase());
        return product ? { productId: product.id, quantity: Number(m.quantity) || 1 } : null;
      })
      .filter((i): i is { productId: string; quantity: number } => i !== null);

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
          ? ` (couldn't match: ${parsed.unmatched.join(', ')})`
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
          return `${i.quantity}x ${product.name}`;
        })
        .join(', ');

      const unmatchedNote = parsed.unmatched?.length
        ? ` (couldn't match: ${parsed.unmatched.join(', ')})`
        : '';

      return {
        reply: `Order #${updatedOrder.order_number} updated! New items: ${summary || 'None'}.${unmatchedNote}`,
        order: updatedOrder,
      };
    }

    if (matchedItems.length === 0) {
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
      items: matchedItems,
    } as any);

    const summary = matchedItems
      .map((i) => {
        const product = available.find((p) => p.id === i.productId)!;
        return `${i.quantity}x ${product.name}`;
      })
      .join(', ');

    const unmatchedNote = parsed.unmatched?.length
      ? ` (couldn't match: ${parsed.unmatched.join(', ')})`
      : '';

    const placementNote = table ? `for Table ${table.name}` : `— Token #${order.token_number}`;

    return {
      reply: `Order placed! ${summary} ${placementNote}.${unmatchedNote}`,
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

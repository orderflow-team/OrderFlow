import { Injectable, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import { ProductsService } from '../../products/products.service';
import { RestaurantService } from '../../restaurant/restaurant.service';
import { CustomersService } from '../../customers/customers.service';
import { GeminiKeyPoolService } from '../../../common/services/gemini-key-pool.service';
import { unitFamilyMismatch } from '../../products/utils/pricing.util';

@Injectable()
export class OrderParserService {
  constructor(
    private geminiKeyPool: GeminiKeyPoolService,
    private ordersService: OrdersService,
    private productsService: ProductsService,
    private restaurantService: RestaurantService,
    private customersService: CustomersService,
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
  async parseChatOrder(
    businessId: string,
    message: string,
    orderId?: string,
    pendingContact?: { customerName?: string | null; phone?: string | null },
  ) {
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

    // Handles a handful of common non-order questions (greeting/help, "what's
    // on the menu", an order's status, a customer's balance) entirely locally
    // before any order-parsing machinery runs — see tryLocalQuery. Only for a
    // fresh top-level message, never mid-edit (orderId set means we're either
    // continuing an explicit edit session, or this is the recursive call after
    // resolving a table/token edit target below).
    if (!orderId) {
      const localReply = await this.tryLocalQuery(businessId, message, available, tables);
      if (localReply) return localReply;
    }

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

    // Each chat message is parsed statelessly — parseChatOrder has no memory of
    // anything sent before it. So when a PRIOR message named a customer but had
    // no items yet ("order for Neel 9876543210"), that captured contact never
    // resulted in an order to attach to, and this message (just the items) has
    // no way to know "Neel" was already established. pendingContact is how the
    // caller (chat-order.controller.ts, fed by the frontend echoing back the
    // pendingCustomer field from that earlier reply — see parseChatOrder's
    // return shape below) threads that forward. Only fills in whatever THIS
    // message's own extraction didn't already find — a name/phone mentioned
    // right here always wins over a stale pending one.
    if (contactInfo && pendingContact) {
      if (!contactInfo.customerName && pendingContact.customerName) {
        contactInfo.customerName = pendingContact.customerName;
      }
      if (!contactInfo.phone && pendingContact.phone) {
        contactInfo.phone = pendingContact.phone;
      }
    }

    const itemMessage = contactInfo ? contactInfo.cleanMessage : message;

    // A message that's nothing BUT customer info ("order for Neel 9876543210",
    // no items at all) leaves nothing for the item parser to work with — handle
    // it here directly rather than spending a Gemini call (or, if Gemini isn't
    // configured, failing outright) parsing an empty item message.
    if (!existingOrder && contactInfo?.customerName && !itemMessage) {
      await this.ordersService.resolveOrCreateCustomerByContact(businessId, {
        customerName: contactInfo.customerName,
        phone: contactInfo.phone || undefined,
      });
      const phoneNote = contactInfo.phone ? ` (${contactInfo.phone})` : '';
      return {
        reply: `Got it — saved ${contactInfo.customerName}${phoneNote} as the customer. What would you like to order?`,
        order: null,
        pendingCustomer: { customerName: contactInfo.customerName, phone: contactInfo.phone },
      };
    }

    let parsed: {
      matched: { menuName: string; rawName?: string | null; quantity: number; unit?: string | null }[];
      unmatched: { name: string; quantity?: number; unit?: string | null; price?: number | null }[];
      orderType?: string;
      tableName?: string | null;
      customerName?: string | null;
      phone?: string | null;
    } | null = existingOrder
      ? this.tryDeterministicEditParse(message, existingOrder, available)
      : this.tryDeterministicParse(itemMessage, available, tables);

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
            "matched": [{ "menuName": "exact name from the menu list above", "rawName": "the customer's own wording for this item (not the menu name), used only if it turns out to need its own separate line item", "quantity": number, "unit": "string or null" }],
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
            "matched": [{ "menuName": "exact name from the menu list above", "rawName": "the customer's own wording for this item (not the menu name), used only if it turns out to need its own separate line item", "quantity": number, "unit": "string or null" }],
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

    const matchedItems: { productId: string; quantity: number; unit: string | undefined }[] = [];
    // "2kg" of a product priced per "liter" — mass can't be converted to
    // volume (or vice versa) without knowing the specific product's
    // density, which this app doesn't track, so there's no safe price to
    // charge against the EXISTING product's own rate. Rather than silently
    // treating "2" as if it meant 2 liters (a real charge, just a wrong
    // one), redirect it into a unit-qualified new product ("fortune oil
    // (kg)", using the CUSTOMER'S OWN wording via rawName — not the
    // existing catalog product's canonical name — so it reads as their own
    // item, not a rebrand of the one already on the menu) — same ₹0/"set
    // its price" treatment newItems below already gives any brand-new item,
    // so the merchant sees it as its own line needing a real price rather
    // than a silently mispriced charge against the wrong unit. The
    // qualifying suffix keeps it from colliding with the original product's
    // name (findOrCreateProductFromCustomName in orders.service.ts reuses
    // any EXISTING product with the exact same name, which would just
    // resolve straight back to the original here) — rawName alone,
    // unsuffixed, risks the very same collision whenever the customer's own
    // wording happens to match the catalog name closely enough to have
    // matched it in the first place.
    const redirectedItems: { customProductName: string; quantity: number; unitPrice: number; unit: string | undefined }[] = [];

    for (const m of parsed.matched || []) {
      const product = available.find((p) => p.name.toLowerCase() === m.menuName?.toLowerCase());
      if (!product) continue;
      const quantity = Number(m.quantity) || 1;
      const unit = m.unit || undefined;

      if (unit && unitFamilyMismatch(product.unit, unit)) {
        // Fold the stated quantity into the new product's own unit ("10kg"
        // as one pack, at order quantity 1) rather than quantity 10 + unit
        // "kg" — same convention newItems below uses, see its comment for
        // why: there's no existing rate to charge a bare per-kg price
        // against, so the merchant should just type the one total they'd
        // actually charge for this whole pack.
        //
        // The NAME suffix stays unit-family-only ("(kg)"), NOT quantity-
        // specific ("(10kg)") — findOrCreateProductFromCustomName
        // (orders.service.ts) resolves by exact name, so baking the
        // quantity in here would make every distinct quantity ("10kg" vs
        // "20kg" of the same redirected item) spawn its own separate draft
        // product instead of reusing one, unlike the plain unmatched-item
        // path below (whose name never encodes quantity at all).
        const customerWording = (m.rawName || product.name).trim();
        redirectedItems.push({ customProductName: `${customerWording} (${unit})`, quantity: 1, unitPrice: 0, unit: `${quantity}${unit}` });
        continue;
      }

      matchedItems.push({ productId: product.id, quantity, unit });
    }

    // A quantity already folded into a compound unit ("10kg", "500gm" — see
    // newItems/redirectedItems below) reads naturally alone; only a PLAIN
    // count needs the "Nx"/"N unit" treatment.
    const fmtQty = (quantity: number, unit?: string) => {
      if (!unit) return `${quantity}x`;
      return quantity === 1 && /^\d/.test(unit) ? unit : `${quantity} ${unit}`;
    };

    // Anything not on the menu still gets ordered — same seamless quick-add the
    // New Order screen's free-text flow already does, whether this is a brand-new
    // order or an edit. findOrCreateProductFromCustomName (orders.service.ts)
    // creates the Product row the first time each name is used.
    //
    // When a unit was stated ("10kg mango"), there's no existing per-unit rate
    // to charge against — this is a BRAND NEW product — so, same as the New
    // Order screen's free-text quick-add (search.trim() + parseQuantityUnit
    // there: an "Add '10kg mango'" tap creates it at quantity 1, unit "10kg"),
    // fold the stated quantity into the unit itself rather than splitting it
    // into quantity 10 + unit "kg". That way the ONE price the merchant enters
    // (or the customer's own stated total, e.g. "10kg mango 1000rs") is simply
    // the total for that whole pack — no mental division into a per-kg rate —
    // while still leaving the compound unit ("10kg") in place for
    // pricing.util.ts's convertUnitPrice/canonicalUnitKey to scale correctly
    // if a later order asks for a different quantity of this same product.
    // A bare count with no unit ("2 rice") is unaffected — that's not a new
    // pack size, just a plain quantity.
    const newItems = [
      ...(parsed.unmatched || [])
        .filter((u) => u && typeof u.name === 'string' && u.name.trim().length > 0)
        .map((u) => {
          const statedQuantity = Number(u.quantity) || 1;
          const statedTotal = u.price != null && !isNaN(Number(u.price)) ? Number(u.price) : null;
          if (u.unit) {
            return {
              customProductName: u.name.trim(),
              quantity: 1,
              unitPrice: statedTotal ?? 0,
              unit: `${statedQuantity}${u.unit}`,
            };
          }
          return {
            customProductName: u.name.trim(),
            quantity: statedQuantity,
            unitPrice: statedTotal !== null ? statedTotal / statedQuantity : 0,
            unit: undefined,
          };
        }),
      ...redirectedItems,
    ];

    if (existingOrder) {
      const originalCount = existingOrder.items?.length || 0;
      const hasClearIntent = this.isWholeOrderClearIntent(message);

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
      // A message like "order for Neel 9876543210" with no items mentioned yet
      // still identifies a customer — save/update that record now (same dedup
      // logic a real order would use) rather than losing the info because
      // there's nothing to order. A bare phone with no name is skipped: without
      // a name, resolveOrCreateCustomerByContact can't create anything new to
      // report as "saved" (it can only enrich an EXISTING customer's phone).
      if (contactInfo?.customerName) {
        await this.ordersService.resolveOrCreateCustomerByContact(businessId, {
          customerName: contactInfo.customerName,
          phone: contactInfo.phone || undefined,
        });
        const phoneNote = contactInfo.phone ? ` (${contactInfo.phone})` : '';
        return {
          reply: `Got it — saved ${contactInfo.customerName}${phoneNote} as the customer. What would you like to order?`,
          order: null,
          pendingCustomer: { customerName: contactInfo.customerName, phone: contactInfo.phone },
        };
      }

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
      // The order itself now carries the customer — nothing left pending, so
      // the caller should drop whatever pendingContact it was holding for the
      // next message (see the pendingContact param above).
      pendingCustomer: null,
    };
  }

  // Longer/more-specific unit words are listed before their single-letter shorthand
  // (e.g. "liters?" before "l") — regex alternation takes the first branch that
  // matches, so "l" alone would otherwise win against "4liter" and strand "iter"
  // in the item name.
  //
  // Deliberately excludes "mg"/"milligram" even though every other weight unit is
  // covered: in this shop's catalog "500mg" almost always denotes a medicine's
  // dosage baked into the PRODUCT NAME itself (e.g. "Paracetamol 500mg"), not a
  // bulk quantity someone is ordering. Recognizing it as a unit would strip it out
  // of the name and break exact catalog matches like "2 paracetamol 500mg" (which
  // already fast-paths correctly today via a plain name match). Leaving it
  // unrecognized means that phrase's "500mg" simply stays part of the name, same
  // as it always has.

  // A digit run that allows comma grouping ("1,000", "1,00,000") and an
  // optional decimal part — used everywhere a price or quantity number gets
  // matched, in place of a bare \d+(?:\.\d+)?. Deliberately lenient about
  // WHERE the commas fall (doesn't enforce strict 3-digit Western or
  // 2-digit Indian grouping) since this is casual chat input, not a
  // validated numeric field — a stray or unconventionally-placed comma
  // should still parse rather than reject the whole segment. Every caller
  // that pulls a number out of a match against this MUST strip commas
  // before calling Number(...) on it (e.g. `raw.replace(/,/g, '')`).
  private static readonly NUMBER_PATTERN = '\\d[\\d,]*(?:\\.\\d+)?';

  // List-separator commas ("rice, sugar") vs a thousands-grouping comma
  // inside a single number ("1,000rs") look identical to a naive [,;&\n]
  // separator match — without this distinction, "10kg mango 1,000rs" gets
  // sliced in half AT the comma before the price regex ever sees the whole
  // number. Only a comma flanked by a digit on BOTH sides is a thousands
  // grouping ("1,000") — everything else (including a comma glued straight
  // to the NEXT item's leading quantity digit with no space, e.g. "rice
  // ,500gm wheat", which real chat input does constantly) is a genuine list
  // separator. Matching requires only ONE side to be non-digit (the
  // alternation below), not both — an earlier version required non-digit on
  // BOTH sides, which meant "rice ,500gm wheat ,5liter oil" never split at
  // all: every comma here has a digit immediately after it, so the whole
  // stricter match failed at every single comma and the entire message fell
  // through as one unsplit blob.
  private static readonly LIST_SEPARATOR = '(?:(?<!\\d),|,(?!\\d))|;|&|\\n|\\band\\b';

  private static readonly UNIT_WORDS =
    // Weight
    'kilograms?|kilos?|kgs?|grams?|gms?|g|quintals?|qtl|' +
    // Volume
    'millilitres?|milliliters?|mls?|litres?|liters?|ltrs?|l|' +
    // Count / packaging
    'pieces?|pcs?|pc|packets?|pkts?|packs?|pack|boxe?s?|cartons?|cases?|dozens?|pairs?|sets?|bundles?|bunche?s?|units?|' +
    // Containers
    'bags?|sacks?|tins?|cans?|bottles?|jars?|pouche?s?|sachets?|rolls?|tubes?|vials?|strips?|pallets?|' +
    // Pharmacy
    'tablets?|tabs?|capsules?|caps?|' +
    // Restaurant
    'plates?|' +
    // Length
    'metres?|meters?|m|inche?s?|in';

  // Same list, minus "dozens?" — used by parseSegment's "a/an <unit>" check
  // (e.g. "a bottle of oil", "a packet of chips") so it doesn't collide with
  // "a dozen X" already being handled as quantity 12 via WORD_NUMBERS below;
  // matching "dozen" here too would instead read it as quantity 1, unit
  // "dozen".
  private static readonly UNIT_WORDS_NO_DOZEN = OrderParserService.UNIT_WORDS.replace('dozens?|', '');

  // Words that could otherwise get swept into the leading "<name> order ..."
  // capture below via greedy backtracking — e.g. "Make Neel order 2 rice" should
  // yield the name "Neel", not "Make Neel".
  private static readonly NAME_STOPWORDS = new Set([
    'make', 'create', 'place', 'please', 'order', 'new', 'the', 'a', 'an',
    'this', 'that', 'my', 'quick', 'table', 'kindly', 'hi', 'hello', 'hey',
  ]);

  // Words that describe HOW/WHEN an order is fulfilled rather than WHO it's
  // for — only checked by extractContactInfo's relaxed end-of-string name
  // retry (see allowEndOfString there), where a phone number was found
  // elsewhere in the message but nothing else anchors the name, e.g.
  // "9876543210 for pickup" must not save "Pickup" as the customer name.
  // Not needed by the normal digit-anchored match: "for pickup 2kg rice"
  // already reads oddly enough as real input that this doesn't try to guard
  // it too.
  private static readonly ORDER_CONTEXT_WORDS = new Set([
    'pickup', 'pick', 'delivery', 'takeaway', 'later', 'now', 'today', 'tomorrow', 'here',
  ]);

  // Matched via matchLeadingVerb (exact word, or a close typo/Hinglish match)
  // against just the FIRST word of a segment, so a product name that happens
  // to contain one of these words mid-string (e.g. "7up plus") isn't mistaken
  // for an edit command. Canonical English forms plus a few common Hinglish
  // equivalents — typos of any of these (e.g. "remve", "cancle", "ad") are
  // caught by matchLeadingVerb's fuzzy check, not spelled out here.
  private static readonly ADD_VERB_WORDS = ['add', 'plus', 'extra', 'another', 'dalo', 'daalo'];
  private static readonly REMOVE_VERB_WORDS = ['remove', 'delete', 'cancel', 'hatao', 'nikalo'];
  private static readonly SET_VERB_WORDS = ['change', 'set', 'update', 'badlo'];

  // Whole-message shapes only — "remove all"/"clear"/"delete all"/"empty"/"cancel"
  // as a bare command (optionally with harmless filler like "the order"/"cart"/
  // "items"/"everything") mean wipe the WHOLE order. These must NOT match when a
  // specific item follows ("remove all sugar", "clear the rice") — that's an
  // ordinary per-item removal already handled correctly by REMOVE_VERB_WORDS
  // further down, and used to get swallowed by a naive `.includes('remove all')`
  // substring check that fired on "remove all sugar" too, silently wiping the
  // entire order instead of just the one item asked about.
  private static readonly WHOLE_ORDER_CLEAR_PATTERNS = [
    /^(?:please\s+)?(?:clear|empty)(?:\s+(?:the\s+)?(?:order|cart|everything))?\.?$/i,
    /^(?:please\s+)?(?:remove|delete)\s+(?:all|everything)(?:\s+(?:the\s+)?items?)?\.?$/i,
    /^cancel(?:\s+the)?(?:\s+order)?\.?$/i,
  ];

  // Cardinal number words a customer might type instead of a digit (typo-prone
  // chat input, or just casual phrasing like "two rice" / "a dozen eggs").
  // Deliberately excludes "a"/"an"/"single" — those double as ordinary
  // articles elsewhere and would misfire on unrelated phrasing.
  private static readonly WORD_NUMBERS: Record<string, number> = {
    half: 0.5, couple: 2, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
  };

  // Matches a phone number in any of the forms a customer might type it: a
  // plain 10-digit run, optionally preceded by a "+91"/"91" country code or a
  // leading trunk "0", with the 10 digits themselves optionally split 5+5 by
  // a single space or dash (the way Indian mobile numbers are usually
  // displayed) — e.g. "9876543210", "+91 98765 43210", "91-9876543210",
  // "098765-43210". The leading-zero/country-code branches deliberately don't
  // support a SECOND split (e.g. "0-98765-43210" fails to match the "0"
  // branch's core cleanly since core is right below) — kept simple since that
  // combination is not how anyone actually writes a number. Wrap this in
  // `(?<!\d)...(?!\d)` when matching standalone (see extractPhoneCandidate)
  // so it can't grab the tail end of an unrelated longer digit run (an order
  // ID, a barcode); the embedded use inside "change customer to <phone>"
  // below doesn't need that guard since the command prefix already anchors it.
  private static readonly PHONE_CORE = '(?:\\+?91[-\\s]?|0[-\\s]?)?\\d{5}[-\\s]?\\d{5}';

  /**
   * Strips everything but digits from a PHONE_CORE match and reduces it to
   * the bare 10-digit form the rest of the app expects (create-customer.dto.ts's
   * `^\d{10}$` validator, business-connections.service.ts's last-10-digits
   * match) — un-prefixing a "91" country code or a leading "0" trunk digit.
   * Returns null if what's left over isn't a clean 10-digit number (should
   * only happen if PHONE_CORE's own shape is ever loosened without updating
   * this in lockstep).
   */
  private normalizePhoneDigits(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return null;
  }

  /**
   * Finds a standalone phone number anywhere in text (not tied to any
   * particular surrounding command phrase) and normalizes it — used by
   * extractContactInfo for a brand-new order's "for Neel 9876543210" /
   * "+91 98765 43210" style contact info. Returns null if nothing phone-shaped
   * is present.
   */
  private extractPhoneCandidate(text: string): { phone: string; index: number; length: number } | null {
    const match = text.match(new RegExp(`(?<!\\d)(${OrderParserService.PHONE_CORE})(?!\\d)`));
    if (!match || match.index === undefined) return null;
    const phone = this.normalizePhoneDigits(match[0]);
    if (!phone) return null;
    return { phone, index: match.index, length: match[0].length };
  }

  // Exact-match only (the whole trimmed message, punctuation stripped) — a
  // substring match would risk firing mid-sentence on unrelated chat.
  private static readonly GREETING_MESSAGES = new Set(['hi', 'hello', 'hey', 'hii', 'helo', 'yo', 'hola', 'namaste']);
  private static readonly HELP_MESSAGES = new Set(['help', 'what can you do', 'how does this work', 'commands']);

  // Whole-message shapes only, same reasoning as GREETING/HELP above — "menu"
  // as a bare word is safe to treat as an intent since it's not a plausible
  // item name, but only when it's the ENTIRE message, not a fragment of one.
  private static readonly MENU_PATTERNS = [
    /^(?:show\s+(?:me\s+)?)?(?:the\s+)?menu\??$/i,
    /^what(?:'s|\s+is)\s+on\s+the\s+menu\??$/i,
    /^what\s+do\s+you\s+have\??$/i,
    /^(?:show\s+(?:me\s+)?(?:the\s+)?)?(?:products|items|catalog)\??$/i,
  ];

  // Deliberately English-only ("status") rather than also matching Hinglish
  // "kaha hai"/"kahan hai" ("where is") — those are too easily a genuine
  // question about something else entirely ("where is the shop", "where is
  // my sugar") to safely redirect into an order-status lookup.
  private static readonly STATUS_KEYWORD = /\bstatus\b/i;
  private static readonly BALANCE_KEYWORD = /\b(?:balance|owe|owes|dues|outstanding|udhaar|baki)\b/i;

  /**
   * Handles a handful of common non-order chat questions entirely locally —
   * no catalog matching, no Gemini call: a bare greeting/help request,
   * "what's on the menu", an order's status by table/token, and a customer's
   * outstanding balance by name or phone. Each is deliberately narrow (an
   * exact whole-message match, or a keyword that isn't a plausible item name)
   * so it can't misfire on a genuine order — "status"/"balance"/"menu" would
   * otherwise just become a nonsense ₹0 quick-add product if left to fall
   * into item parsing, which is strictly worse. Returns null (no local intent
   * recognized) for everything else, so parseChatOrder falls through to its
   * normal order-parsing flow exactly as before.
   */
  private async tryLocalQuery(
    businessId: string,
    message: string,
    available: any[],
    tables: any[],
  ): Promise<{ reply: string; order: null } | null> {
    const trimmed = message.trim();
    const lower = trimmed.toLowerCase().replace(/[!.?]+$/, '');

    if (OrderParserService.GREETING_MESSAGES.has(lower)) {
      return {
        reply: `Hi! Tell me what you'd like to order (e.g. "2kg rice, 1 dozen eggs"), or ask for the "menu", an order's "status" (e.g. "status of table 3"), or a customer's "balance" (e.g. "balance for Neel").`,
        order: null,
      };
    }
    if (OrderParserService.HELP_MESSAGES.has(lower)) {
      return {
        reply: `I can place an order ("2kg rice, 1 dozen eggs" or "for Neel 9876543210 2kg rice"), edit one ("add 2 cokes to table 3"), show the "menu", check an order's "status" (by table or token), or look up a customer's "balance".`,
        order: null,
      };
    }

    if (OrderParserService.MENU_PATTERNS.some((re) => re.test(trimmed))) {
      const list = available.map((p) => `${p.name} (₹${Number(p.selling_price)})`).join(', ');
      return { reply: `Here's what we have: ${list}.`, order: null };
    }

    if (OrderParserService.STATUS_KEYWORD.test(trimmed)) {
      const tokenMatch = trimmed.match(/\b(?:token|tk|tok)\s*(\d+)\b/i);
      const tableMatch = trimmed.match(/\b(?:for\s+)?(?:table|t)\s*([a-zA-Z0-9]+)\b/i);

      let order: any = null;
      if (tokenMatch) {
        order = await this.ordersService.findActiveOrderByToken(Number(tokenMatch[1]), businessId);
        if (!order) {
          return { reply: `There's no active order for Takeaway Token #${tokenMatch[1]} right now.`, order: null };
        }
      } else if (tableMatch) {
        const raw = tableMatch[1].trim().toLowerCase();
        const table = tables.find((t) => {
          const name = t.name.toLowerCase();
          return name === raw || name === `t${raw}` || `t${name}` === raw;
        });
        if (!table) {
          return {
            reply: `I couldn't find table "${tableMatch[1]}". Available tables: ${tables.map((t) => t.name).join(', ') || 'none'}.`,
            order: null,
          };
        }
        order = await this.ordersService.findActiveOrderByTable(table.id, businessId);
        if (!order) {
          return { reply: `There is no active order for Table ${table.name} right now.`, order: null };
        }
      } else {
        return {
          reply: `Which order? Tell me a table (e.g. "status of table 3") or a takeaway token (e.g. "status of token 5").`,
          order: null,
        };
      }

      const itemsSummary = (order.items || [])
        .map((i: any) => `${Number(i.quantity)}x ${i.product?.name || i.custom_product_name || 'item'}`)
        .join(', ');
      const statusLabel = String(order.status || 'draft').replace(/_/g, ' ');
      return {
        reply: `Order #${order.order_number} is ${statusLabel}. Items: ${itemsSummary || 'none'}. Total: ₹${Number(order.total_amount).toFixed(2)}.`,
        order: null,
      };
    }

    if (OrderParserService.BALANCE_KEYWORD.test(trimmed)) {
      const phoneMatch = this.extractPhoneCandidate(trimmed);
      const nameMatch =
        trimmed.match(/\b(?:for|of)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})\b/i) ||
        trimmed.match(/^([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})(?:'s)?\s+(?:balance|dues|outstanding)\b/i);

      if (!phoneMatch && !nameMatch) {
        return { reply: `Whose balance would you like to check? e.g. "balance for Neel" or a phone number.`, order: null };
      }

      const customers = await this.customersService.findAll(businessId);
      let customer = phoneMatch ? customers.find((c) => c.phone === phoneMatch.phone) : undefined;
      if (!customer && nameMatch) {
        const rawName = nameMatch[1].trim().toLowerCase();
        customer =
          customers.find((c) => c.name.trim().toLowerCase() === rawName) ||
          customers.find((c) => c.name.trim().toLowerCase().includes(rawName));
      }

      if (!customer) {
        const who = nameMatch ? nameMatch[1].trim() : phoneMatch!.phone;
        return { reply: `I couldn't find a customer matching "${who}".`, order: null };
      }

      const owed = Number(customer.outstanding_amount || 0);
      const credit = Number(customer.advance_balance || 0);
      const parts: string[] = [];
      if (owed > 0) parts.push(`owes ₹${owed.toFixed(2)}`);
      if (credit > 0) parts.push(`has ₹${credit.toFixed(2)} in advance credit`);
      const summary = parts.length > 0 ? parts.join(' and ') : 'has no outstanding balance';
      return { reply: `${customer.name} ${summary}.`, order: null };
    }

    return null;
  }

  /**
   * Pulls a customer name and/or phone number out of a brand-new chat order
   * message, e.g. "Neel order 2kg rice 4liter milk", "make a order for the
   * neel 3kg rice 9876543210", or "9876543210 for Neel" (phone BEFORE the
   * name) — deterministically, so this works whether the item list itself
   * ends up going through the fast path below or falls through to Gemini.
   *
   * The phone can appear ANYWHERE in the message (extractPhoneCandidate scans
   * the whole string, not just a fixed position) and is always extracted
   * first. Name extraction then runs on whatever's left, trying two
   * unambiguous shapes ("<name> order ..." leading, or "for [the] <name> ..."
   * trailing): first anchored on a trailing quantity/phone digit as before
   * (handles the name coming BEFORE the phone or an item), and — only if that
   * finds nothing AND hasPhoneAttempt sees independent evidence a phone was
   * attempted somewhere in the message (a clean 10-digit match, OR just a 5+
   * digit run that didn't validate, e.g. a typo like "906598042") — a second,
   * relaxed pass that also accepts the name simply being the last thing left
   * in the message. This covers two cases at once: the phone coming BEFORE
   * the name with nothing left to anchor on ("9876543210 for Neel"), and a
   * phone-shaped number that failed to validate sitting where the phone would
   * be ("Het 906598042 order" — leadingMatch's optional numeric span absorbs
   * the bad number so "order" still reads as immediately following the
   * name). Gating on hasPhoneAttempt rather than a validated phone matters
   * because a customer's name shouldn't be lost just because they mistyped
   * their number — without SOME digit-based evidence though, an ordinary
   * phone-less sentence ending in "for <word>" ("cancel my order for the
   * weekend") would risk misreading the trailing word as a name; see
   * ORDER_CONTEXT_WORDS for the same concern the other way around ("for
   * pickup"). Anything less clear-cut than these shapes is simply left alone
   * (no name/phone captured) rather than guessed — a miss here just costs a
   * defaulted "Chat Order" name, never a misplaced item.
   */
  private extractContactInfo(message: string): { customerName: string | null; phone: string | null; cleanMessage: string } {
    let text = message.trim();

    // Strip a leading "new order" (bare, or with a make/place/create/start
    // verb in front) BEFORE phone/name extraction runs — otherwise "new" has
    // nowhere to go: it isn't part of the name (NAME_STOPWORDS already
    // rejects it there), isn't a phone digit, and isn't consumed by the
    // "(?:order\s+)?for" name-match pattern below (that only swallows a
    // literal "order" immediately before "for", not an extra word ahead of
    // it). Left unstripped, "new" survives into cleanMessage as a stray
    // one-word "item" — which then either fails Gemini strangely or, worse,
    // becomes a real ₹0 "New" quick-add product on the order, silently
    // completing it before the actual items ever get typed.
    const beforeNewOrderStrip = text;
    text = text.replace(/^(?:please\s+)?(?:(?:make|create|place|start)\s+(?:a|an)\s+)?new\s+order\s*/i, '').trim();
    text = text.replace(/^(?:please\s+)?(?:make|create|place)\s+(?:a|an)\s+order\s*/i, '').trim();
    const strippedExplicitNewOrder = text !== beforeNewOrderStrip;

    const titleCase = (raw: string) =>
      raw.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    // "new order neel," — an explicit new-order command immediately followed
    // by ONLY a bare name and a trailing comma, nothing else. The comma is
    // what makes this unambiguous versus a genuine one-word item order like
    // "new order rice" (no comma, left untouched below): it's the shape
    // someone produces typing a customer's name first, meaning to follow with
    // items as a comma-separated list or as separate messages afterward, and
    // hitting send before any item made it in. Without this, "neel" falls
    // through as cleanMessage and becomes a real ₹0 "Neel" quick-add product
    // on the order instead of being saved as the customer.
    if (strippedExplicitNewOrder) {
      const bareNameMatch = text.match(/^([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})\s*,\s*$/);
      if (bareNameMatch) {
        return { customerName: titleCase(bareNameMatch[1]), phone: null, cleanMessage: '' };
      }
    }

    // A conversational opener ("give me", "I want", "can I get") isn't part
    // of the order — left in place it becomes the leading word of whatever
    // segment follows, which then fails parseSegment's confidence guard (its
    // quantity digit reads as a stray token stuck inside a longer "name") and
    // bails the whole deterministic parse to Gemini even for an otherwise
    // trivial single-item order.
    text = text
      .replace(/^(?:please\s+)?give\s+me\s+/i, '')
      .replace(/^(?:please\s+)?i(?:'d|\s+would)\s+like\s+(?:to\s+(?:order|get|have)\s+)?/i, '')
      .replace(/^(?:please\s+)?i\s+(?:want|need)\s+(?:to\s+(?:order|get|have)\s+)?/i, '')
      .replace(/^(?:please\s+)?can\s+i\s+(?:get|have)\s+/i, '')
      .replace(/^(?:please\s+)?i'?ll\s+(?:have|take)\s+/i, '')
      .trim();

    let phone: string | null = null;
    const phoneMatch = this.extractPhoneCandidate(text);
    if (phoneMatch) {
      phone = phoneMatch.phone;
      text = (text.slice(0, phoneMatch.index) + ' ' + text.slice(phoneMatch.index + phoneMatch.length)).trim();
    }

    // A number that DOESN'T reduce to a clean phone (a typo, a missing/extra
    // digit — e.g. "Het 906598042 order", 9 digits instead of 10) never got
    // stripped above, but it's still clear evidence someone tried to give a
    // phone number here. That's enough to justify the relaxed end-of-string
    // name retry below even though `phone` itself stayed null — otherwise the
    // name would be lost for no reason beyond the number being wrong, which
    // is a worse outcome than just leaving phone unset. 5+ digits is the
    // threshold since ordinary item quantities in this parser are practically
    // never that long.
    const hasPhoneAttempt = phone !== null || /\d{5,}/.test(text);

    let customerName: string | null = null;

    const tryMatchName = (allowEndOfString: boolean): boolean => {
      const anchor = allowEndOfString ? '(?:\\+?\\d|$)' : '\\+?\\d';

      // "Neel order 2kg rice..." / "Neel's order for 3kg rice..." — name leads,
      // immediately followed by the word "order" itself. The optional numeric
      // span before "order" absorbs a phone number that failed to extract
      // above (see hasPhoneAttempt) — e.g. "Het 906598042 order" — so it
      // doesn't block "order" from being recognized right after the name.
      const leadingMatch = text.match(
        new RegExp(`^([a-zA-Z]+(?:\\s+[a-zA-Z]+){0,2})(?:'s)?\\s+(?:\\d[\\d\\s-]*\\s+)?order\\b(?:\\s+for)?[\\s,]*(?=${anchor})`, 'i'),
      );
      const leadingWords = leadingMatch ? leadingMatch[1].trim().split(/\s+/) : [];
      if (leadingMatch && !leadingWords.some((w) => OrderParserService.NAME_STOPWORDS.has(w.toLowerCase()))) {
        customerName = titleCase(leadingMatch[1]);
        text = text.slice(leadingMatch[0].length).trim();
        return true;
      }

      // "order for [the] Neel..." — name trails "for". "table" is excluded so
      // "for table 3..." isn't mistaken for a customer named Table — that phrase
      // is handled separately by the dine-in table detection.
      const nameMatch = text.match(
        new RegExp(`\\b(?:order\\s+)?for\\s+(?:the\\s+)?(?!table\\b)([a-zA-Z]+(?:\\s+[a-zA-Z]+){0,2})(?=[\\s,]*${anchor})`, 'i'),
      );
      if (nameMatch && nameMatch.index !== undefined) {
        const words = nameMatch[1].trim().split(/\s+/);
        if (allowEndOfString && words.some((w) => OrderParserService.ORDER_CONTEXT_WORDS.has(w.toLowerCase()))) {
          return false; // e.g. "... for pickup" — not a customer name
        }
        customerName = titleCase(nameMatch[1]);
        text = (text.slice(0, nameMatch.index) + ' ' + text.slice(nameMatch.index + nameMatch[0].length)).trim();
        return true;
      }

      return false;
    };

    if (!tryMatchName(false) && hasPhoneAttempt) {
      tryMatchName(true);
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
    const NUM = OrderParserService.NUMBER_PATTERN;
    const priceMatch = text.match(
      new RegExp(`(?:₹\\s*${NUM}|${NUM}\\s*(?:rs\\.?|rupees?)|rs\\.?\\s*${NUM})\\s*$`, 'i'),
    );
    if (priceMatch && priceMatch.index !== undefined) {
      trailingPrice = priceMatch[0].trim();
      body = text.slice(0, priceMatch.index).trim();
    }

    const chunks = body.match(new RegExp(`${NUM}[^\\d]*`, 'g'));
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

    // ";" and newlines are just as valid a list separator as "," — a pasted
    // shopping list is often one item per line, or semicolon-separated. See
    // LIST_SEPARATOR's own comment for why a comma isn't always a separator.
    const segments = new RegExp(OrderParserService.LIST_SEPARATOR, 'i').test(text)
      ? text
          .split(new RegExp(`\\s*(?:${OrderParserService.LIST_SEPARATOR})\\s*`, 'i'))
          .map((s) => s.trim())
          .filter(Boolean)
      : this.splitImplicitSegments(text).map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) return null;

    // rawName carries the customer's OWN wording for a matched item (before
    // it got resolved to the catalog's canonical name) — needed so that if
    // this item later turns out to need a unit-mismatch redirect to a new
    // product (see parseChatOrder), that new product is named after what
    // the customer actually typed, not the existing catalog product's name.
    const matched: { menuName: string; rawName: string; quantity: number; unit?: string | null }[] = [];
    const unmatched: { name: string; quantity?: number; unit?: string | null; price?: number | null }[] = [];

    for (const segment of segments) {
      let item = this.parseSegment(segment);
      let catalogMatch: string | 'ambiguous' | null = null;

      if (item) {
        catalogMatch = this.matchCatalogProduct(item.name.toLowerCase(), available);
        if (catalogMatch === 'ambiguous') return null; // ambiguous — let Gemini sort it out
      } else {
        // parseSegment rejected this segment — its confidence guard treats a
        // trailing digit(+unit) token left in the name as a quantity it
        // failed to extract, which is exactly "oil 4kg" (name FIRST, then
        // quantity+unit — parseSegment only looks for a LEADING quantity).
        // But a catalog product can also legitimately have a quantity baked
        // into its own name ("E2E Test Snack 100g"), so check whether the
        // segment's own untouched text already names a real product BEFORE
        // assuming it's "name + quantity" and splitting it — otherwise
        // typing that product's exact name would get needlessly and
        // wrongly split into quantity 100, unit "g", name "e2e test snack".
        // Deliberately an EXACT match only — matchCatalogProduct's substring
        // tier would wrongly protect "rice 5" too (since "rice" is a
        // substring of "rice 5"), swallowing "5" into the name instead of
        // reading it as a trailing quantity. Exact-only means this can only
        // ever fire for a product whose own name is a full, character-for-
        // character match, which is precisely the "E2E Test Snack 100g"
        // case it exists to protect.
        const wholeTextItem = this.parseWholeSegmentAsName(segment);
        const wholeTextMatch = wholeTextItem
          ? available.find((p) => p.name.trim().toLowerCase() === wholeTextItem!.name.toLowerCase())?.name ?? null
          : null;

        if (wholeTextItem && wholeTextMatch) {
          item = wholeTextItem;
          catalogMatch = wholeTextMatch;
        } else {
          item = this.parseTrailingQuantitySegment(segment);
          if (!item) return null; // not a clean/simple enough segment — bail to Gemini
          catalogMatch = this.matchCatalogProduct(item.name.toLowerCase(), available);
          if (catalogMatch === 'ambiguous') return null;
        }
      }

      if (catalogMatch) {
        matched.push({ menuName: catalogMatch, rawName: item.name, quantity: item.quantity, unit: item.unit });
        continue;
      }

      unmatched.push({ name: item.name, quantity: item.quantity, unit: item.unit, price: item.price });
    }

    return { matched, unmatched, orderType, tableName };
  }

  /**
   * Matches a normalized item name against the product catalog using the same
   * exact -> substring -> fuzzy tiers tryDeterministicParse and
   * tryDeterministicEditParse both rely on. Returns the catalog's exact
   * (correctly-cased) product name, 'ambiguous' if more than one product is a
   * plausible match at some tier, or null if nothing matches at all.
   */
  private matchCatalogProduct(normalizedName: string, available: any[]): string | 'ambiguous' | null {
    const exact = available.find((p) => p.name.trim().toLowerCase() === normalizedName);
    if (exact) return exact.name;

    // "e2e test snack" should still find "E2E Test Snack 100g" — same substring
    // tier invoice-scan.service.ts's fuzzy matcher uses, kept independent here
    // rather than shared so this feature can't regress that already-verified one.
    //
    // The catalog-name-is-longer direction is deliberately a PREFIX match
    // (pname.startsWith(...)), not "found anywhere in" — a bare generic word
    // like "oil" would otherwise match ANY product whose name happens to
    // contain it, most commonly one specific BRANDED item ("Fortune Oil")
    // the customer never named. Catalog naming conventions put the generic
    // product name first and append size/variant qualifiers after it (which
    // startsWith still catches, e.g. "E2E Test Snack 100g"), while a brand
    // is conventionally PREPENDED before the generic term — so requiring a
    // prefix match captures "name + suffix" while excluding "brand + name".
    // A plain "oil" should create its own generic product rather than
    // silently attaching to whichever specific brand happens to be in
    // stock; typing the brand name itself still matches it directly.
    const substringMatches = available.filter((p) => {
      const pname = p.name.trim().toLowerCase();
      if (Math.min(pname.length, normalizedName.length) < 4) return false;
      return normalizedName.includes(pname) || pname.startsWith(normalizedName);
    });
    if (substringMatches.length > 1) return 'ambiguous';
    if (substringMatches.length === 1) return substringMatches[0].name;

    // Length-scaled tolerance — same scaling matchLeadingVerb already uses for
    // edit-command verb typos: 1 edit for a 4-5 letter name, 2 from six
    // letters up, nothing at all below 4 (a typo that short is too likely to
    // coincidentally land on a different, unrelated short product name — e.g.
    // "dal" vs "gal" — for a fuzzy guess to be worth the risk). This used to
    // bail out of fuzzy matching entirely for anything under 6 characters
    // combined length, which meant exactly the short, common grocery names
    // most likely to get casually mistyped ("rice" -> "ricee", "sugar" ->
    // "suger") got NO typo tolerance at all.
    const fuzzyMatches = available.filter((p) => {
      const pname = p.name.trim().toLowerCase();
      const shorter = Math.min(pname.length, normalizedName.length);
      if (shorter < 4) return false;
      const threshold = shorter >= 6 ? 2 : 1;
      if (Math.abs(pname.length - normalizedName.length) > threshold) return false;
      return this.levenshteinDistance(pname, normalizedName) <= threshold;
    });
    if (fuzzyMatches.length > 1) return 'ambiguous';
    if (fuzzyMatches.length === 1) return fuzzyMatches[0].name;

    return null;
  }

  /**
   * Same exact -> substring -> fuzzy matching tiers as matchCatalogProduct, but
   * against the item names already sitting in an edit-in-progress order (both
   * menu-linked and custom items) instead of the product catalog — used to
   * resolve which line a "remove X" / "set X to N" edit command refers to.
   */
  private resolveExistingItemKey(
    normalizedName: string,
    matchedMap: Map<string, { menuName: string; rawName: string; quantity: number; unit?: string | null }>,
    unmatchedMap: Map<string, { name: string; quantity: number; unit?: string | null; price: number }>,
  ): { store: 'matched' | 'unmatched'; key: string } | 'ambiguous' | null {
    const inMatched = matchedMap.has(normalizedName);
    const inUnmatched = unmatchedMap.has(normalizedName);
    if (inMatched && inUnmatched) return 'ambiguous';
    if (inMatched) return { store: 'matched', key: normalizedName };
    if (inUnmatched) return { store: 'unmatched', key: normalizedName };

    const allKeys = [
      ...Array.from(matchedMap.keys()).map((key) => ({ store: 'matched' as const, key })),
      ...Array.from(unmatchedMap.keys()).map((key) => ({ store: 'unmatched' as const, key })),
    ];

    // Same prefix-only rule as matchCatalogProduct's substringMatches — see
    // its comment for why (avoids a bare "oil" hitting a branded "Fortune
    // Oil" already sitting in the order, while "e2e test snack" still hits
    // "e2e test snack 100g").
    const substringHits = allKeys.filter(({ key }) => {
      if (Math.min(key.length, normalizedName.length) < 4) return false;
      return normalizedName.includes(key) || key.startsWith(normalizedName);
    });
    if (substringHits.length > 1) return 'ambiguous';
    if (substringHits.length === 1) return substringHits[0];

    // Same length-scaled tolerance as matchCatalogProduct — see its fuzzyMatches
    // for the reasoning.
    const fuzzyHits = allKeys.filter(({ key }) => {
      const shorter = Math.min(key.length, normalizedName.length);
      if (shorter < 4) return false;
      const threshold = shorter >= 6 ? 2 : 1;
      if (Math.abs(key.length - normalizedName.length) > threshold) return false;
      return this.levenshteinDistance(key, normalizedName) <= threshold;
    });
    if (fuzzyHits.length > 1) return 'ambiguous';
    if (fuzzyHits.length === 1) return fuzzyHits[0];

    return null;
  }

  /**
   * Checks whether a segment opens with one of the given edit-command verbs
   * (e.g. ADD_VERB_WORDS) — either spelled exactly, or a typo/casual misspelling
   * close enough that it's clearly meant to be one of them ("remve", "ad",
   * "cancle", "chnge"). Tolerance scales with word length so short words still
   * need a near-exact match: 1 edit for a 4-5 letter word, 2 edits from six
   * letters up — the same distance the catalog fuzzy-matcher uses for longer
   * strings. Only the leading word is ever tested, so a product name that
   * merely contains a verb-like word mid-string never triggers this.
   */
  /**
   * True only when the ENTIRE (trimmed) message is one of WHOLE_ORDER_CLEAR_PATTERNS
   * — a bare "clear"/"remove all"/"delete all"/"empty"/"cancel" command, optionally
   * with filler words referring to the order itself. A message that names a specific
   * item ("remove all sugar") is deliberately NOT a match here — see that constant's
   * comment for why.
   */
  private isWholeOrderClearIntent(message: string): boolean {
    const trimmed = message.trim();
    return OrderParserService.WHOLE_ORDER_CLEAR_PATTERNS.some((re) => re.test(trimmed));
  }

  private matchLeadingVerb(segment: string, verbWords: string[]): { rest: string } | null {
    const wordMatch = segment.match(/^([a-zA-Z]+)\s+(.+)$/);
    if (!wordMatch) return null;

    const firstWord = wordMatch[1].toLowerCase();
    const rest = wordMatch[2];
    if (verbWords.includes(firstWord)) return { rest };

    if (firstWord.length < 4) return null;
    const threshold = firstWord.length >= 6 ? 2 : 1;
    const isCloseMatch = verbWords.some((verb) => {
      if (Math.abs(verb.length - firstWord.length) > threshold) return false;
      return this.levenshteinDistance(firstWord, verb) <= threshold;
    });

    return isCloseMatch ? { rest } : null;
  }

  /**
   * Deterministic local parser for editing an existing chat order — same
   * "don't guess, bail to the whole message returning null" philosophy as
   * tryDeterministicParse, applied to add/remove/set-quantity edit commands
   * layered on top of the order's current item list instead of a from-scratch
   * order. Only three unambiguous per-segment shapes are recognized: "add 2
   * rice" / "plus ..." / "extra ..." / a bare "2 rice" (add), "remove milk" /
   * "delete ..." / "cancel ..." (delete the item entirely, regardless of any
   * quantity mentioned — same contract as the Gemini prompt this replaces),
   * and "set/change rice to 5" (overwrite quantity, or delete if set to 0).
   * Each verb also tolerates a close typo ("remve", "cancle", "chnge") or a
   * common Hinglish equivalent ("dalo", "hatao", "badlo") via matchLeadingVerb,
   * and quantities may be spelled out ("two rice", "a dozen eggs") as well as
   * digits. Anything else — replace-style instructions, ambiguous item references,
   * bare item names with no leading quantity — returns null for the WHOLE
   * message so parseChatOrder falls through to Gemini exactly as before. A
   * customer-change request ("for Priya now", "change customer to Neel", "set
   * customer 9876543210") is only honored on those exact unambiguous shapes;
   * any other mention of "customer" bails to Gemini rather than guessing.
   */
  private tryDeterministicEditParse(
    message: string,
    existingOrder: any,
    available: any[],
  ): {
    matched: { menuName: string; rawName: string; quantity: number; unit?: string | null }[];
    unmatched: { name: string; quantity: number; unit?: string | null; price: number | null }[];
    customerName: string | null;
    phone: string | null;
  } | null {
    const trimmed = message.trim();
    if (this.isWholeOrderClearIntent(message)) {
      return { matched: [], unmatched: [], customerName: null, phone: null };
    }

    let text = trimmed;
    let customerName: string | null = null;
    let phone: string | null = null;

    const titleCase = (raw: string) =>
      raw.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    const changeCustomerMatch = text.match(/\b(?:change|set)\s+customer\s+to\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})\b/i);
    const forNowMatch = text.match(/\bfor\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})\s+now\b/i);
    const customerPhoneMatch = text.match(
      new RegExp(`\\b(?:change|set)\\s+customer\\s+(?:to\\s+)?(${OrderParserService.PHONE_CORE})\\b`, 'i'),
    );
    const normalizedCustomerPhone = customerPhoneMatch ? this.normalizePhoneDigits(customerPhoneMatch[1]) : null;

    if (changeCustomerMatch && changeCustomerMatch.index !== undefined) {
      customerName = titleCase(changeCustomerMatch[1]);
      text = (text.slice(0, changeCustomerMatch.index) + ' ' + text.slice(changeCustomerMatch.index + changeCustomerMatch[0].length)).trim();
    } else if (customerPhoneMatch && normalizedCustomerPhone && customerPhoneMatch.index !== undefined) {
      phone = normalizedCustomerPhone;
      text = (text.slice(0, customerPhoneMatch.index) + ' ' + text.slice(customerPhoneMatch.index + customerPhoneMatch[0].length)).trim();
    } else if (forNowMatch && forNowMatch.index !== undefined) {
      customerName = titleCase(forNowMatch[1]);
      text = (text.slice(0, forNowMatch.index) + ' ' + text.slice(forNowMatch.index + forNowMatch[0].length)).trim();
    } else if (/\bcustomer\b/i.test(text)) {
      return null; // ambiguous customer instruction — let Gemini sort it out
    }

    text = text.replace(/\s+/g, ' ').trim();

    // rawName carries the customer's OWN wording for a matched item (see
    // tryDeterministicParse's identical field for the full rationale) — for
    // an item loaded from the order's EXISTING rows below there's no chat
    // text to recover, so it just mirrors menuName; for an item newly
    // matched further down by this edit command, it's the customer's actual
    // typed text for that item.
    const matchedMap = new Map<string, { menuName: string; rawName: string; quantity: number; unit?: string | null }>();
    const unmatchedMap = new Map<string, { name: string; quantity: number; unit?: string | null; price: number }>();

    for (const item of existingOrder.items || []) {
      const quantity = Number(item.quantity) || 0;
      const unit = item.unit || null;
      if (item.product) {
        const key = item.product.name.trim().toLowerCase();
        const entry = matchedMap.get(key);
        if (entry) entry.quantity += quantity;
        else matchedMap.set(key, { menuName: item.product.name, rawName: item.product.name, quantity, unit });
      } else {
        const name = item.custom_product_name || 'Unknown Item';
        const key = name.trim().toLowerCase();
        const total = Number(item.unit_price || 0) * quantity;
        const entry = unmatchedMap.get(key);
        if (entry) {
          entry.quantity += quantity;
          entry.price += total;
        } else {
          unmatchedMap.set(key, { name, quantity, unit, price: total });
        }
      }
    }

    if (text) {
      const segments = new RegExp(OrderParserService.LIST_SEPARATOR, 'i').test(text)
        ? text.split(new RegExp(`\\s*(?:${OrderParserService.LIST_SEPARATOR})\\s*`, 'i')).map((s) => s.trim()).filter(Boolean)
        : [text];
      if (segments.length === 0) return null;

      const wordNumPattern = Object.keys(OrderParserService.WORD_NUMBERS).join('|');

      for (const segment of segments) {
        const setVerbMatch = this.matchLeadingVerb(segment, OrderParserService.SET_VERB_WORDS);
        if (setVerbMatch) {
          const setBodyMatch = setVerbMatch.rest.match(
            new RegExp(
              `^(?:the\\s+)?(?:quantity\\s+of\\s+)?(.+?)\\s+to\\s+(${OrderParserService.NUMBER_PATTERN}|${wordNumPattern})\\s*(${OrderParserService.UNIT_WORDS})?\\.?\\s*$`,
              'i',
            ),
          );
          if (!setBodyMatch) return null; // recognized "change/set ..." but not the "X to N" shape — bail

          const rawName = setBodyMatch[1].trim();
          const itemKey = rawName.toLowerCase();
          const qtyToken = setBodyMatch[2].toLowerCase();
          const newQty = /^\d/.test(qtyToken) ? Number(qtyToken.replace(/,/g, '')) : OrderParserService.WORD_NUMBERS[qtyToken];
          const newUnit = setBodyMatch[3] ? setBodyMatch[3].toLowerCase() : undefined;

          const resolved = this.resolveExistingItemKey(itemKey, matchedMap, unmatchedMap);
          if (resolved === 'ambiguous') return null;

          if (resolved) {
            if (newQty === 0) {
              if (resolved.store === 'matched') matchedMap.delete(resolved.key);
              else unmatchedMap.delete(resolved.key);
            } else if (resolved.store === 'matched') {
              const entry = matchedMap.get(resolved.key)!;
              entry.quantity = newQty;
              // Keep rawName current with THIS command's own wording — if this
              // unit change ends up triggering a redirect to a new product
              // (see parseChatOrder's unitFamilyMismatch handling), it should
              // be named after what the customer just typed here, not stale
              // text from whenever this item first entered the order.
              if (newUnit) {
                entry.unit = newUnit;
                entry.rawName = rawName;
              }
            } else {
              const entry = unmatchedMap.get(resolved.key)!;
              // entry.unit already being compound ("10kg" — one fixed pack,
              // from newItems' convention below) and this command NOT
              // restating a fresh unit means there's no sane new pack size
              // to compute: overwriting just the quantity would leave the
              // stale "10kg" in place and get double-folded into a garbage
              // unit string ("5" + "10kg") once this flows back through
              // parseChatOrder. Bail to Gemini instead, which has the full
              // order context to redecide the item's total quantity/price.
              // A command that DOES restate a unit ("set rice to 15 kg")
              // is fine — it replaces entry.unit with a plain "kg" below,
              // which newItems then folds correctly on its own.
              if (entry.unit && /^\d/.test(entry.unit) && !newUnit) return null;
              const prevUnitPrice = entry.quantity > 0 ? entry.price / entry.quantity : 0;
              entry.quantity = newQty;
              entry.price = prevUnitPrice * newQty;
              if (newUnit) entry.unit = newUnit;
            }
          } else if (newQty > 0) {
            // Not currently in the order — treat as a fresh add of that quantity.
            const catalogMatch = this.matchCatalogProduct(itemKey, available);
            if (catalogMatch === 'ambiguous') return null;
            if (catalogMatch) {
              matchedMap.set(catalogMatch.toLowerCase(), { menuName: catalogMatch, rawName, quantity: newQty, unit: newUnit || null });
            } else {
              unmatchedMap.set(itemKey, { name: rawName, quantity: newQty, unit: newUnit || null, price: 0 });
            }
          }
          continue;
        }

        const removeVerbMatch = this.matchLeadingVerb(segment, OrderParserService.REMOVE_VERB_WORDS);
        if (removeVerbMatch) {
          const body = removeVerbMatch.rest;
          const parsedSeg = this.parseSegment(body);
          const itemName = (parsedSeg ? parsedSeg.name : body).trim().toLowerCase();
          if (!itemName) return null;

          const resolved = this.resolveExistingItemKey(itemName, matchedMap, unmatchedMap);
          if (resolved === 'ambiguous' || !resolved) return null; // unknown/ambiguous item — let Gemini sort it out
          if (resolved.store === 'matched') matchedMap.delete(resolved.key);
          else unmatchedMap.delete(resolved.key);
          continue;
        }

        const addVerbMatch = this.matchLeadingVerb(segment, OrderParserService.ADD_VERB_WORDS);
        let body: string;
        if (addVerbMatch) {
          body = addVerbMatch.rest;
        } else if (/^\d/.test(segment) || new RegExp(`^(?:${wordNumPattern})\\b`, 'i').test(segment)) {
          // Bare segment with no verb — only accepted as an implicit add when it
          // leads with a quantity (digit or spelled-out, e.g. "2 more rice" /
          // "two more rice"); anything else is too ambiguous between
          // add/remove/set to guess safely.
          body = segment;
        } else {
          return null;
        }

        const parsedSeg = this.parseSegment(body);
        if (!parsedSeg) return null;

        const normalized = parsedSeg.name.toLowerCase();

        // Does this name already resolve to something sitting in the order —
        // same substring/fuzzy tiers "remove"/"set" above already use via
        // resolveExistingItemKey? Checked BEFORE matchCatalogProduct (which
        // only ever looks at the CATALOG) since an existing non-catalog
        // item can only ever be found this way. Matters for phrasing like
        // "add 5kg more rice" against an order that already has "rice" —
        // parsedSeg.name comes out as "more rice" (nothing strips the filler
        // "more"), which resolveExistingItemKey's substring tier still
        // matches to the existing "rice" key; without this check it fell
        // through to matchCatalogProduct (catalog-only, so no match) and
        // silently created a bogus SEPARATE "more rice" item instead.
        const existingResolved = this.resolveExistingItemKey(normalized, matchedMap, unmatchedMap);
        if (existingResolved === 'ambiguous') return null;

        if (existingResolved) {
          if (existingResolved.store === 'matched') {
            matchedMap.get(existingResolved.key)!.quantity += parsedSeg.quantity;
          } else {
            const entry = unmatchedMap.get(existingResolved.key)!;
            // entry.unit already being compound ("10kg" — one fixed pack,
            // from newItems' convention below) means quantity is frozen at
            // "how many packs", not a raw amount — adding parsedSeg.quantity
            // on top (treating prevUnitPrice as if it were a per-single-unit
            // rate) produces a nonsensical total, and the stale unit string
            // would double-fold into garbage downstream regardless. Bail to
            // Gemini, which has the full order context to redecide the
            // item's quantity/price properly.
            if (entry.unit && /^\d/.test(entry.unit)) return null;
            const prevUnitPrice = entry.quantity > 0 ? entry.price / entry.quantity : 0;
            const addedTotal = parsedSeg.price != null ? parsedSeg.price : prevUnitPrice * parsedSeg.quantity;
            entry.quantity += parsedSeg.quantity;
            entry.price += addedTotal;
          }
          continue;
        }

        const catalogMatch = this.matchCatalogProduct(normalized, available);
        if (catalogMatch === 'ambiguous') return null;

        if (catalogMatch) {
          matchedMap.set(catalogMatch.toLowerCase(), { menuName: catalogMatch, rawName: parsedSeg.name, quantity: parsedSeg.quantity, unit: parsedSeg.unit || null });
        } else {
          unmatchedMap.set(normalized, {
            name: parsedSeg.name,
            quantity: parsedSeg.quantity,
            unit: parsedSeg.unit || null,
            price: parsedSeg.price ?? 0,
          });
        }
      }
    }

    return {
      matched: Array.from(matchedMap.values()),
      unmatched: Array.from(unmatchedMap.values()),
      customerName,
      phone,
    };
  }

  /**
   * Strips a trailing stated price ("1000rs", "rs 1000", "₹1000", with
   * optional comma grouping like "1,000rs") from the end of text, if
   * present. Shared by parseSegment, parseWholeSegmentAsName, and
   * parseTrailingQuantitySegment, which all need the exact same rule.
   */
  private stripTrailingPrice(text: string): { price: number | null; text: string } {
    const NUM = OrderParserService.NUMBER_PATTERN;
    const priceMatch = text.match(
      new RegExp(`(?:₹\\s*(${NUM})|(${NUM})\\s*(?:rs\\.?|rupees?)|rs\\.?\\s*(${NUM}))\\s*$`, 'i'),
    );
    if (!priceMatch) return { price: null, text };
    const raw = priceMatch[1] ?? priceMatch[2] ?? priceMatch[3];
    return { price: Number(raw.replace(/,/g, '')), text: text.slice(0, priceMatch.index).trim() };
  }

  /**
   * Strips a trailing stated price (same rule as parseSegment) and treats
   * whatever's left as the WHOLE item name at quantity 1 — no quantity
   * extraction, no confidence guard. Used only to check "does this segment's
   * own untouched text already name a real catalog product" before deciding
   * whether a trailing digit(+unit) is part of that name or an actual
   * quantity (see parseTrailingQuantitySegment below).
   */
  private parseWholeSegmentAsName(segment: string): { name: string; quantity: number; unit?: string; price: number | null } | null {
    const { price, text: withoutPrice } = this.stripTrailingPrice(segment.trim());
    const name = withoutPrice.trim();
    if (!name) return null;
    return { name, quantity: 1, unit: undefined, price };
  }

  /**
   * Fallback for "oil 4kg" / "sugar 2 packets" / "rice 5" — name FIRST,
   * quantity(+unit) trailing — only ever tried by tryDeterministicParse
   * after BOTH parseSegment's leading-quantity parse AND a whole-segment
   * catalog-name check have already failed, so it can't compete with the
   * normal "2kg rice" shape or misfire on a product whose own name happens
   * to end in a number.
   */
  private parseTrailingQuantitySegment(segment: string): { name: string; quantity: number; unit?: string; price: number | null } | null {
    const { price, text } = this.stripTrailingPrice(segment.trim());
    if (!text) return null;

    const trailingQtyMatch = text.match(
      new RegExp(`^(.+?)\\s+(${OrderParserService.NUMBER_PATTERN})\\s*(${OrderParserService.UNIT_WORDS})?\\b\\.?$`, 'i'),
    );
    if (!trailingQtyMatch) return null;

    const name = trailingQtyMatch[1].trim().replace(/[,;:.!?]+$/, '').trim();
    if (!name) return null;

    return {
      name,
      quantity: Number(trailingQtyMatch[2].replace(/,/g, '')),
      unit: trailingQtyMatch[3] ? trailingQtyMatch[3].toLowerCase() : undefined,
      price,
    };
  }

  /** One "[qty][unit]? name [price]?" segment, e.g. "10kg mango 1000rs" or "2 rice". */
  private parseSegment(segment: string): { name: string; quantity: number; unit?: string; price: number | null } | null {
    const stripped = this.stripTrailingPrice(segment.trim());
    const price = stripped.price;
    let text = stripped.text;
    if (!text) return null;

    let quantity = 1;
    let unit: string | undefined;
    // The lookahead after the optional unit requires whatever follows the
    // digits to be whitespace, end-of-string, or a recognized unit word —
    // never an arbitrary letter run. Without it, a product name that starts
    // with a digit (e.g. "7up") would have its leading digit stolen as a
    // quantity ("7up" -> qty 7, name "up").
    const qtyMatch = text.match(
      new RegExp(`^(${OrderParserService.NUMBER_PATTERN})(?:\\s*(${OrderParserService.UNIT_WORDS})\\b)?(?=\\s|$)\\.?\\s*(?:of\\s+)?`, 'i'),
    );
    // "a bottle of oil" / "a kg of sugar" / "an inch of ribbon" — quantity 1
    // with an explicit unit, distinct from the WORD_NUMBERS check below
    // (that handles NUMBER words like "two" or "a dozen"; this is "a"/"an"
    // directly followed by a unit word, with nothing numeric being said at
    // all). Checked before the digit path can't apply anyway (no digit here)
    // but after it in code order for readability; checked with UNIT_WORDS_NO_DOZEN
    // so "a dozen eggs" keeps going through the WORD_NUMBERS path below
    // (quantity 12) instead of being read as quantity 1, unit "dozen".
    const articleUnitMatch = text.match(
      new RegExp(`^(?:a|an)\\s+(${OrderParserService.UNIT_WORDS_NO_DOZEN})\\b\\.?\\s*(?:of\\s+)?`, 'i'),
    );

    if (qtyMatch) {
      quantity = Number(qtyMatch[1].replace(/,/g, ''));
      unit = qtyMatch[2] ? qtyMatch[2].toLowerCase() : undefined;
      text = text.slice(qtyMatch[0].length).trim();
    } else if (articleUnitMatch) {
      quantity = 1;
      unit = articleUnitMatch[1].toLowerCase();
      text = text.slice(articleUnitMatch[0].length).trim();
    } else {
      // No digit — try a spelled-out cardinal ("two rice", "a dozen eggs"),
      // which needs a following space rather than glueing straight to a unit
      // the way "2kg" does. "a"/"an" aren't in WORD_NUMBERS generally (too
      // easy to misfire on ordinary article usage), but "a dozen"/"a couple"
      // are common enough idioms to strip explicitly here.
      const wordNumPattern = Object.keys(OrderParserService.WORD_NUMBERS).join('|');
      const articleStripped = text.replace(/^(?:a|an)\s+(?=(?:dozen|couple)\b)/i, '');
      const wordQtyMatch = articleStripped.match(
        new RegExp(`^(${wordNumPattern})\\s+(${OrderParserService.UNIT_WORDS})?\\.?\\s*(?:of\\s+)?`, 'i'),
      );
      if (wordQtyMatch) {
        quantity = OrderParserService.WORD_NUMBERS[wordQtyMatch[1].toLowerCase()];
        unit = wordQtyMatch[2] ? wordQtyMatch[2].toLowerCase() : undefined;
        text = articleStripped.slice(wordQtyMatch[0].length).trim();
      }
    }

    // Stray leftover punctuation — a trailing "," or ";" that survived
    // because this segment's own separator wasn't perfectly consumed, or a
    // period/colon from casual typing ("2kg rice.") — isn't part of the
    // product name and would otherwise block an exact catalog match.
    const name = text.trim().replace(/[,;:.!?]+$/, '').trim();
    if (!name) return null;

    // Confidence guard: a clean name shouldn't have a standalone number or a
    // number+unit token like "2kg" left in it — that's a quantity we failed to
    // pull out (e.g. a trailing "rice 2kg" our qty regex is leading-only and
    // doesn't catch), not part of the product name. Product names WITH digits in
    // them (e2e, 7up, v8) are fine and shouldn't be rejected just for that. Same
    // goes for a stray spelled-out number ("rice three milk" with no connector,
    // where the digit-boundary segment splitter can't tell the items apart) —
    // bail rather than fold a quantity word into the product name.
    const strayQtyToken = new RegExp(`^${OrderParserService.NUMBER_PATTERN}(?:${OrderParserService.UNIT_WORDS})?$`, 'i');
    const strayWordNumbers = new Set(Object.keys(OrderParserService.WORD_NUMBERS));
    if (name.split(/\s+/).some((word) => strayQtyToken.test(word) || strayWordNumbers.has(word.toLowerCase()))) {
      return null;
    }

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

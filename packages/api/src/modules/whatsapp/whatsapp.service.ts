import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Business } from '../../database/entities/business.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderParserService } from '../ai/services/order-parser.service';
import { EvolutionApiService } from './evolution-api.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly processedMessageIds = new Map<string, number>();
  private readonly DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

  constructor(
    @InjectRepository(Business) private businessRepo: Repository<Business>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private orderParserService: OrderParserService,
    private evolutionApiService: EvolutionApiService,
  ) {}

  /** Handles incoming webhook payloads from Evolution API (MESSAGES_UPSERT & CONNECTION_UPDATE). */
  async handleWebhookPayload(payload: any) {
    let instanceName = '';
    let senderPhone = '';

    try {
      if (!payload || typeof payload !== 'object') return { status: 'ignored' };

      instanceName = payload.instance || payload.instanceName || '';
      const rawEvent = payload.event || '';
      const normalizedEvent = String(rawEvent).toLowerCase().replace(/_/g, '.');

      // Real-time connection status sync on CONNECTION_UPDATE
      if (normalizedEvent === 'connection.update') {
        const state = payload.data?.state || payload.data?.instance?.state;
        const isConnected = state === 'open' || state === 'connected' || state === 'connecting';
        this.logger.log(`WhatsApp connection update for instance ${instanceName}: state=${state}, isConnected=${isConnected}`);

        if (instanceName) {
          let business = await this.businessRepo.findOne({
            where: { whatsapp_instance_name: instanceName },
          });

          if (!business) {
            const idPrefix = instanceName.replace(/^obix-/, '');
            const allBusinesses = await this.businessRepo.find();
            business =
              allBusinesses.find(
                (b) =>
                  b.id.startsWith(idPrefix) ||
                  (b.whatsapp_instance_name &&
                    (b.whatsapp_instance_name === instanceName ||
                      b.whatsapp_instance_name.replace(/^obix-/, '') === idPrefix)),
              ) ||
              (allBusinesses.length === 1 ? allBusinesses[0] : null);
          }

          if (business) {
            await this.businessRepo.update(
              { id: business.id },
              { whatsapp_connected: isConnected, whatsapp_instance_name: instanceName, whatsapp_enabled: true },
            );
          }
        }
        return { status: 'connection_updated', isConnected, state };
      }

      if (normalizedEvent !== 'messages.upsert') {
        return { status: 'ignored' };
      }

      let data = payload.data;
      if (!data || !instanceName) {
        return { status: 'ignored' };
      }

      if (Array.isArray(data)) {
        data = data[0];
      } else if (Array.isArray(data?.messages)) {
        data = data.messages[0];
      }

      if (!data || typeof data !== 'object') {
        return { status: 'ignored' };
      }

      let remoteJid = data.key?.remoteJid || '';
      if ((!remoteJid || remoteJid.includes('@lid')) && data.key?.remoteJidAlt) {
        remoteJid = data.key.remoteJidAlt;
      }

      // Ignore group chats (@g.us), broadcasts (@broadcast), newsletters (@newsletter), and status updates
      if (
        !remoteJid ||
        remoteJid.endsWith('@g.us') ||
        remoteJid.endsWith('@broadcast') ||
        remoteJid.endsWith('@newsletter') ||
        remoteJid.startsWith('status@')
      ) {
        return { status: 'ignored_group_or_status' };
      }

      senderPhone = remoteJid.split('@')[0].replace(/\D/g, '');
      const customerName = data.pushName || 'WhatsApp Customer';

      // Extract message text from conversation, extendedTextMessage, captions, viewOnce, or button/list responses
      const msg = data.message || {};
      const messageText = (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        msg.ephemeralMessage?.message?.conversation ||
        msg.ephemeralMessage?.message?.extendedTextMessage?.text ||
        msg.ephemeralMessage?.message?.imageMessage?.caption ||
        msg.viewOnceMessage?.message?.conversation ||
        msg.viewOnceMessage?.message?.extendedTextMessage?.text ||
        msg.viewOnceMessageV2?.message?.conversation ||
        msg.viewOnceMessageV2?.message?.extendedTextMessage?.text ||
        msg.buttonsResponseMessage?.selectedButtonId ||
        msg.buttonsResponseMessage?.selectedDisplayText ||
        msg.listResponseMessage?.title ||
        msg.templateButtonReplyMessage?.selectedId ||
        ''
      ).trim();

      if (!messageText || messageText.length === 0) {
        return { status: 'ignored_empty_text' };
      }

      // Ignore outgoing bot replies (identified by bot response prefixes) to prevent infinite loops
      if (data.key?.fromMe) {
        const isBotReply =
          messageText.startsWith('Order placed') ||
          messageText.startsWith('Order #') ||
          messageText.startsWith('✅') ||
          messageText.startsWith('💳') ||
          messageText.startsWith('❌') ||
          messageText.startsWith('Sorry, we couldn') ||
          messageText.startsWith('Got it — saved') ||
          messageText.startsWith('Hi!') ||
          messageText.startsWith('I can place');

        if (isBotReply) {
          return { status: 'ignored_bot_reply' };
        }
        // Note: Human-typed messages from the connected phone (fromMe: true) are allowed for developer testing
      }

      // Only process as an order if the chat contains "obix" (case-insensitive, e.g., "Hi Obix", "hi obix").
      // Otherwise, ignore it as a normal personal chat with family or friends.
      if (!messageText.toLowerCase().includes('obix')) {
        return { status: 'ignored_not_an_order' };
      }

      // Deduplication: prevent duplicate order entries and duplicate replies for repeated webhook events
      const messageId = data.key?.id;
      const now = Date.now();

      // Clean up expired cache entries
      for (const [key, timestamp] of this.processedMessageIds.entries()) {
        if (now - timestamp > this.DEDUP_TTL_MS) {
          this.processedMessageIds.delete(key);
        }
      }

      if (messageId && this.processedMessageIds.has(messageId)) {
        this.logger.log(`Skipping duplicate WhatsApp webhook event for message ID: ${messageId}`);
        return { status: 'ignored_duplicate' };
      }

      const contentDedupKey = `${instanceName}_${senderPhone}_${messageText.toLowerCase()}_${Math.floor(now / 5000)}`;
      if (this.processedMessageIds.has(contentDedupKey)) {
        this.logger.log(`Skipping duplicate WhatsApp order within 5s window for ${senderPhone}: "${messageText}"`);
        return { status: 'ignored_duplicate' };
      }

      if (messageId) this.processedMessageIds.set(messageId, now);
      this.processedMessageIds.set(contentDedupKey, now);

      // Find the matching store registered with this instance name or ID prefix
      let business = await this.businessRepo.findOne({
        where: { whatsapp_instance_name: instanceName },
      });

      if (!business) {
        const idPrefix = instanceName.replace(/^obix-/, '');
        const allBusinesses = await this.businessRepo.find();
        business =
          allBusinesses.find(
            (b) =>
              b.id.startsWith(idPrefix) ||
              (b.whatsapp_instance_name &&
                (b.whatsapp_instance_name === instanceName ||
                  b.whatsapp_instance_name.replace(/^obix-/, '') === idPrefix)),
          ) ||
          (allBusinesses.length === 1 ? allBusinesses[0] : null);
      }

      if (!business) {
        this.logger.warn(`Received WhatsApp message for unknown store instance: ${instanceName}`);
        return { status: 'store_not_configured' };
      }

      // Auto-enable & link instance name if missing
      if (!business.whatsapp_enabled || !business.whatsapp_instance_name || business.whatsapp_instance_name !== instanceName) {
        await this.businessRepo.update(
          { id: business.id },
          { whatsapp_enabled: true, whatsapp_connected: true, whatsapp_instance_name: instanceName },
        );
        business.whatsapp_enabled = true;
        business.whatsapp_instance_name = instanceName;
      }

      this.logger.log(`Processing WhatsApp order message for ${business.name} from ${customerName} (${senderPhone}): "${messageText}"`);

      // Strip Obix trigger prefix (e.g., "Hi Obix,", "hi obix", "Obix:") for clean item parsing
      const cleanOrderText = messageText
        .replace(/^hi\s+obix[,:\s]*/i, '')
        .replace(/^obix[,:\s]*/i, '')
        .trim() || messageText;

      // 1. Run AI Order Parser
      const parseResult = await this.orderParserService.parseChatOrder(
        business.id,
        cleanOrderText,
        undefined,
        { customerName, phone: senderPhone },
      );

      // 2. Mark order origin as 'whatsapp' if created
      if (parseResult.order?.id) {
        await this.orderRepo.update({ id: parseResult.order.id }, { origin: 'whatsapp' });
      }

      // 3. Send automated WhatsApp reply back to customer
      if (parseResult.reply) {
        await this.evolutionApiService.sendTextMessage(
          instanceName,
          senderPhone,
          parseResult.reply,
        ).catch((err) => this.logger.warn(`Failed to send WhatsApp reply: ${err.message}`));
      }

      return { status: 'success', orderId: parseResult.order?.id || null };
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp webhook payload: ${err.message}`, err.stack);
      if (instanceName && senderPhone) {
        await this.evolutionApiService.sendTextMessage(
          instanceName,
          senderPhone,
          `Sorry, we couldn't process your order automatically: ${err.message || 'Please try again.'}`,
        ).catch(() => null);
      }
      return { status: 'error', error: err.message };
    }
  }

  /** Sends automated WhatsApp status updates (confirmed, paid, etc.) to the customer. */
  async notifyOrderStatusUpdate(orderId: string, newStatus: string) {
    try {
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: { items: { product: true }, customer: true },
      });
      if (!order) return;

      const business = await this.businessRepo.findOne({
        where: { id: order.business_id },
      });
      if (!business || !business.whatsapp_instance_name || !business.whatsapp_enabled) return;

      const phone = order.customer?.phone || (order as any).phone;
      if (!phone) return;

      const itemsSummary = (order.items || [])
        .map((i: any) => `${Number(i.quantity)}x ${i.product?.name || i.custom_product_name || 'item'}`)
        .join(', ');

      const storeName = business.name || 'Store';
      const formattedTotal = Number(order.total_amount || 0).toFixed(2);
      let message = '';

      const lowerStatus = newStatus.toLowerCase();
      if (['confirmed', 'accepted', 'completed', 'preparing', 'dispatched', 'delivered'].includes(lowerStatus)) {
        message = `✅ *Order Confirmed!*\n\nYour order *#${order.order_number}* has been confirmed by *${storeName}*.\n\n📦 *Items:* ${itemsSummary || 'Items ordered'}\n💰 *Total:* ₹${formattedTotal}\n📌 *Status:* ${newStatus.toUpperCase()}\n\nThank you for ordering with us!`;
      } else if (lowerStatus === 'paid') {
        message = `💳 *Payment Received!*\n\nPayment of ₹${formattedTotal} for Order *#${order.order_number}* has been received by *${storeName}*.\n\n📌 *Status:* Paid & Completed\n\nThank you for shopping with us!`;
      } else if (lowerStatus === 'cancelled') {
        message = `❌ *Order Cancelled*\n\nYour order *#${order.order_number}* has been cancelled by *${storeName}*.`;
      }

      if (message) {
        await this.evolutionApiService.sendTextMessage(business.whatsapp_instance_name, phone, message);
        this.logger.log(`Sent automated WhatsApp status update (${newStatus}) for order #${order.order_number} to ${phone}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send WhatsApp status update for order ${orderId}: ${err.message}`);
    }
  }

  /** Gets current store WhatsApp configuration & QR status. */
  async getSettings(businessId: string) {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    const instanceName = business.whatsapp_instance_name || `obix-${business.id.slice(0, 8)}`;
    const connectionState = await this.evolutionApiService.fetchConnectionState(instanceName);

    const isConnected = connectionState === 'open' || connectionState === 'connected' || connectionState === 'connecting';

    // Auto-sync status flag and instance name in DB if changed
    if (business.whatsapp_connected !== isConnected || business.whatsapp_instance_name !== instanceName) {
      await this.businessRepo.update(
        { id: businessId },
        { whatsapp_connected: isConnected, whatsapp_instance_name: instanceName },
      );
    }

    return {
      whatsappPhoneNumber: business.whatsapp_phone_number,
      whatsappInstanceName: instanceName,
      whatsappEnabled: business.whatsapp_enabled,
      whatsappConnected: isConnected,
      connectionState,
    };
  }

  /** Initiates WhatsApp QR code pairing for a store. */
  async connect(businessId: string, phoneNumber?: string) {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    const instanceName = business.whatsapp_instance_name || `obix-${business.id.slice(0, 8)}`;

    // Force delete any old or broken instance to ensure a fresh session
    await this.evolutionApiService.logoutInstance(instanceName).catch(() => null);

    // Update phone & instance name
    await this.businessRepo.update(
      { id: businessId },
      {
        whatsapp_instance_name: instanceName,
        whatsapp_phone_number: phoneNumber || business.whatsapp_phone_number,
        whatsapp_enabled: true,
      },
    );

    // Create fresh instance and fetch brand-new QR code
    await this.evolutionApiService.createInstance(instanceName).catch(() => null);
    const qrData = await this.evolutionApiService.fetchQrCode(instanceName);

    return {
      instanceName,
      qrData, // Contains base64 image or pairing code
    };
  }

  /** Disconnects and deletes WhatsApp instance for a store. */
  async disconnect(businessId: string) {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    if (business.whatsapp_instance_name) {
      await this.evolutionApiService.logoutInstance(business.whatsapp_instance_name).catch(() => null);
    }

    await this.businessRepo.update(
      { id: businessId },
      {
        whatsapp_enabled: false,
        whatsapp_connected: false,
      },
    );

    return { message: 'WhatsApp disconnected successfully' };
  }

  /** Toggles WhatsApp integration on or off. */
  async toggleEnabled(businessId: string, enabled: boolean) {
    await this.businessRepo.update({ id: businessId }, { whatsapp_enabled: enabled });
    return { whatsappEnabled: enabled };
  }
}

import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../../database/entities/business.entity';
import { Customer } from '../../database/entities/customer.entity';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';

// shortcut: the cooldown lives in memory (resets on restart) — a persisted
// last_reminded_at column would need a migration, not worth it for a double-tap guard.
const REMINDER_COOLDOWN_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class CustomerReminderService {
  private lastSent = new Map<string, number>();

  constructor(
    @InjectRepository(Customer) private customers: Repository<Customer>,
    @InjectRepository(Business) private businesses: Repository<Business>,
    private evolution: EvolutionApiService,
  ) {}

  /** Sends the due-payment reminder straight from the business's connected WhatsApp number. */
  async sendDueReminder(customerId: string, businessId: string) {
    const customer = await this.customers.findOne({ where: { id: customerId, business_id: businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const due = Number(customer.outstanding_amount);
    if (!(due > 0.01)) throw new BadRequestException('This customer has no pending dues.');
    if (!customer.phone || customer.phone.replace(/\D/g, '').length < 10) {
      throw new BadRequestException("This customer has no valid phone number. Add their number and try again.");
    }

    const business = await this.businesses.findOne({ where: { id: businessId } });
    if (!business?.whatsapp_instance_name || !business.whatsapp_connected) {
      throw new BadRequestException('WhatsApp is not connected. Connect it in Settings → WhatsApp first.');
    }

    const key = `${businessId}:${customerId}`;
    const last = this.lastSent.get(key);
    if (last && Date.now() - last < REMINDER_COOLDOWN_MS) {
      throw new HttpException('A reminder was already sent to this customer recently.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const storeName = business.name || 'Us';
    const digits = customer.phone.replace(/\D/g, '').slice(-10);
    const text = `Hi ${customer.name},\nIt's a friendly reminder to pay the pending amount of ₹${due.toFixed(2)}.\n\nThank you,\n${storeName}`;

    // sendTextMessage returns null on a gateway failure but throws if the gateway isn't configured.
    const res = await this.evolution
      .sendTextMessage(business.whatsapp_instance_name, `91${digits}`, text)
      .catch(() => null);
    if (!res) throw new BadRequestException('Could not send the WhatsApp message. Check your WhatsApp connection and try again.');

    this.lastSent.set(key, Date.now());
    return { sent: true };
  }
}

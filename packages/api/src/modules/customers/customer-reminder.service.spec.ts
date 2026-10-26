import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { CustomerReminderService } from './customer-reminder.service';

describe('CustomerReminderService', () => {
  let customers: { findOne: jest.Mock };
  let businesses: { findOne: jest.Mock };
  let evolution: { sendTextMessage: jest.Mock };
  let service: CustomerReminderService;

  const customer = { id: 'c1', name: 'Ramesh', phone: '9876543210', outstanding_amount: '250.5' };
  const business = { name: 'Demo Store', whatsapp_instance_name: 'inst', whatsapp_connected: true };

  beforeEach(() => {
    customers = { findOne: jest.fn().mockResolvedValue(customer) };
    businesses = { findOne: jest.fn().mockResolvedValue(business) };
    evolution = { sendTextMessage: jest.fn().mockResolvedValue({ key: 'ok' }) };
    service = new CustomerReminderService(customers as any, businesses as any, evolution as any);
  });

  it('sends the reminder with the due amount to the 91-prefixed number', async () => {
    await expect(service.sendDueReminder('c1', 'b1', 'Neel')).resolves.toEqual({ sent: true });
    const [instance, number, text] = evolution.sendTextMessage.mock.calls[0];
    expect(instance).toBe('inst');
    expect(number).toBe('919876543210');
    expect(text).toContain('₹250.50');
    expect(text).toContain('Demo Store(Neel)');
  });

  it('scopes the customer lookup to the business', async () => {
    await service.sendDueReminder('c1', 'b1');
    expect(customers.findOne).toHaveBeenCalledWith({ where: { id: 'c1', business_id: 'b1' } });
  });

  it('404s for an unknown customer', async () => {
    customers.findOne.mockResolvedValue(null);
    await expect(service.sendDueReminder('x', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects customers with no dues or no valid phone', async () => {
    customers.findOne.mockResolvedValue({ ...customer, outstanding_amount: 0 });
    await expect(service.sendDueReminder('c1', 'b1')).rejects.toBeInstanceOf(BadRequestException);
    customers.findOne.mockResolvedValue({ ...customer, phone: null });
    await expect(service.sendDueReminder('c1', 'b1')).rejects.toBeInstanceOf(BadRequestException);
    expect(evolution.sendTextMessage).not.toHaveBeenCalled();
  });

  it('rejects when WhatsApp is not connected', async () => {
    businesses.findOne.mockResolvedValue({ ...business, whatsapp_connected: false });
    await expect(service.sendDueReminder('c1', 'b1')).rejects.toThrow('WhatsApp is not connected');
  });

  it('errors when Evolution fails to send, and does not start the cooldown', async () => {
    evolution.sendTextMessage.mockResolvedValueOnce(null);
    await expect(service.sendDueReminder('c1', 'b1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sendDueReminder('c1', 'b1')).resolves.toEqual({ sent: true });
  });

  it('blocks a second reminder to the same customer within the cooldown', async () => {
    await service.sendDueReminder('c1', 'b1');
    const err = await service.sendDueReminder('c1', 'b1').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(evolution.sendTextMessage).toHaveBeenCalledTimes(1);
  });
});

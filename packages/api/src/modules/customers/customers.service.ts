import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../database/entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
  ) {}

  create(dto: CreateCustomerDto) {
    const customer = this.customersRepository.create({
      business_id: dto.businessId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      gst_number: dto.gstNumber,
      credit_limit: dto.creditLimit ?? 0,
      notes: dto.notes,
      custom_fields: dto.customFields ?? null,
      payment_terms: dto.paymentTerms ?? 'due_on_receipt',
      trade_discount_percentage: dto.tradeDiscountPercentage ?? 0,
    });
    return this.customersRepository.save(customer);
  }

  // Unpaginated — returns every matching row. Kept as-is (same signature,
  // same full-array return) because chat-order's balance lookup
  // (order-parser.service.ts) needs the whole customer list to search
  // by name/phone, not a page of it. findAllPaginated below is the opt-in
  // alternative for the customers list page itself.
  findAll(businessId: string) {
    return this.customersRepository.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
    });
  }

  async findAllPaginated(businessId: string, limit?: number, offset?: number) {
    const [customers, total] = await this.customersRepository.findAndCount({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { customers, total };
  }

  async findOne(id: string, businessId: string) {
    const customer = await this.customersRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async update(id: string, businessId: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(id, businessId);
    Object.assign(customer, {
      name: dto.name ?? customer.name,
      phone: dto.phone ?? customer.phone,
      email: dto.email ?? customer.email,
      address: dto.address ?? customer.address,
      gst_number: dto.gstNumber ?? customer.gst_number,
      credit_limit: dto.creditLimit ?? customer.credit_limit,
      notes: dto.notes ?? customer.notes,
      custom_fields: dto.customFields !== undefined ? dto.customFields : customer.custom_fields,
      payment_terms: dto.paymentTerms ?? customer.payment_terms,
      trade_discount_percentage: dto.tradeDiscountPercentage ?? customer.trade_discount_percentage,
    });
    return this.customersRepository.save(customer);
  }

  async remove(id: string, businessId: string) {
    const customer = await this.findOne(id, businessId);
    await this.customersRepository.manager.transaction(async (manager) => {
      // 1. Update orders to null out customer reference
      await manager.update('orders', { customer_id: id }, { customer_id: null });

      // 2. Clear customer ledger logs
      await manager.delete('ledgers', { customer_id: id });

      // 3. Clear customer-specific price history
      await manager.delete('price_history', { customer_id: id });

      // 4. Clear salesman check-in visits
      await manager.delete('visits', { customer_id: id });

      // 5. Remove customer record
      await manager.remove(Customer, customer);
    });
    return { deleted: true };
  }
}

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

  // Mirrors the client-side filter the customers list page used to run over
  // its full loaded array (name/phone/address, case-insensitive substring) —
  // moved server-side so it still searches every customer once the list
  // itself is paginated, not just whatever page happens to be loaded.
  async findAllPaginated(businessId: string, search?: string, limit?: number, offset?: number) {
    const query = this.customersRepository
      .createQueryBuilder('customer')
      .where('customer.business_id = :businessId', { businessId });

    if (search) {
      query.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.address ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [customers, total] = await query
      .orderBy('customer.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { customers, total };
  }

  // Cheap aggregate for the customers list page's "total clients"/"clients
  // with dues"/"total outstanding" quick-stats panel and "top 5 by dues"
  // side panel — all used to be computed client-side from the full
  // customers array, which goes wrong the moment that list is paginated
  // instead of loading everyone.
  async getStats(businessId: string) {
    const [{ sum }, totalClients, clientsWithDues, topOutstanding] = await Promise.all([
      this.customersRepository
        .createQueryBuilder('customer')
        .select('COALESCE(SUM(customer.outstanding_amount), 0)', 'sum')
        .where('customer.business_id = :businessId', { businessId })
        .getRawOne<{ sum: string }>(),
      this.customersRepository.count({ where: { business_id: businessId } }),
      this.customersRepository
        .createQueryBuilder('customer')
        .where('customer.business_id = :businessId', { businessId })
        .andWhere('customer.outstanding_amount > 0.01')
        .getCount(),
      this.customersRepository
        .createQueryBuilder('customer')
        .where('customer.business_id = :businessId', { businessId })
        .andWhere('customer.outstanding_amount > 0.01')
        .orderBy('customer.outstanding_amount', 'DESC')
        .take(5)
        .getMany(),
    ]);

    return { totalOutstanding: Number(sum), totalClients, clientsWithDues, topOutstanding };
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

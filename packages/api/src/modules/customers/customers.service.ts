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
    });
    return this.customersRepository.save(customer);
  }

  findAll(businessId: string) {
    return this.customersRepository.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
    });
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

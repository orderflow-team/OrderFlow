import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../database/entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private suppliersRepository: Repository<Supplier>,
  ) {}

  create(dto: CreateSupplierDto) {
    const supplier = this.suppliersRepository.create({
      business_id: dto.businessId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      gst_number: dto.gstNumber,
    });
    return this.suppliersRepository.save(supplier);
  }

  findAll(businessId: string) {
    return this.suppliersRepository.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string) {
    const supplier = await this.suppliersRepository.findOne({ where: { id, business_id: businessId } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async update(id: string, businessId: string, dto: UpdateSupplierDto) {
    const supplier = await this.findOne(id, businessId);
    Object.assign(supplier, {
      name: dto.name ?? supplier.name,
      phone: dto.phone ?? supplier.phone,
      email: dto.email ?? supplier.email,
      address: dto.address ?? supplier.address,
      gst_number: dto.gstNumber ?? supplier.gst_number,
    });
    return this.suppliersRepository.save(supplier);
  }

  async remove(id: string, businessId: string) {
    const supplier = await this.findOne(id, businessId);
    await this.suppliersRepository.remove(supplier);
    return { deleted: true };
  }
}

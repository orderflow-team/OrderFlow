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
      contact_person: dto.contactPerson,
      phone: dto.phone,
      alternate_phone: dto.alternatePhone,
      email: dto.email,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      gst_number: dto.gstNumber,
      pan_number: dto.panNumber,
      drug_license_number: dto.drugLicenseNumber,
      supplier_type: dto.supplierType,
      payment_terms: dto.paymentTerms ?? 'due_on_receipt',
      credit_limit: dto.creditLimit ?? 0,
      trade_discount_percentage: dto.tradeDiscountPercentage ?? 0,
      bank_details: dto.bankDetails,
      is_active: dto.isActive ?? true,
      notes: dto.notes,
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
      contact_person: dto.contactPerson ?? supplier.contact_person,
      phone: dto.phone ?? supplier.phone,
      alternate_phone: dto.alternatePhone ?? supplier.alternate_phone,
      email: dto.email ?? supplier.email,
      address: dto.address ?? supplier.address,
      city: dto.city ?? supplier.city,
      state: dto.state ?? supplier.state,
      pincode: dto.pincode ?? supplier.pincode,
      gst_number: dto.gstNumber ?? supplier.gst_number,
      pan_number: dto.panNumber ?? supplier.pan_number,
      drug_license_number: dto.drugLicenseNumber ?? supplier.drug_license_number,
      supplier_type: dto.supplierType ?? supplier.supplier_type,
      payment_terms: dto.paymentTerms ?? supplier.payment_terms,
      credit_limit: dto.creditLimit ?? supplier.credit_limit,
      trade_discount_percentage: dto.tradeDiscountPercentage ?? supplier.trade_discount_percentage,
      bank_details: dto.bankDetails ?? supplier.bank_details,
      is_active: dto.isActive ?? supplier.is_active,
      notes: dto.notes ?? supplier.notes,
    });
    return this.suppliersRepository.save(supplier);
  }

  async remove(id: string, businessId: string) {
    const supplier = await this.findOne(id, businessId);
    await this.suppliersRepository.remove(supplier);
    return { deleted: true };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepository: Repository<Product>,
  ) {}

  create(dto: CreateProductDto) {
    const product = this.productsRepository.create({
      business_id: dto.businessId,
      name: dto.name,
      sku: dto.sku,
      barcode: dto.barcode,
      category: dto.category,
      unit: dto.unit ?? 'piece',
      purchase_price: dto.purchasePrice,
      selling_price: dto.sellingPrice,
      tax_percentage: dto.taxPercentage ?? 0,
      stock_quantity: dto.stockQuantity ?? 0,
      batch_number: dto.batchNumber,
      expiry_date: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      description: dto.description,
      is_available: dto.isAvailable ?? true,
    });
    return this.productsRepository.save(product);
  }

  findAll(businessId: string, search?: string) {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId });

    if (search) {
      query.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    return query.orderBy('product.created_at', 'DESC').getMany();
  }

  async findOne(id: string, businessId: string) {
    const product = await this.productsRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, businessId: string, dto: UpdateProductDto) {
    const product = await this.findOne(id, businessId);
    Object.assign(product, {
      name: dto.name ?? product.name,
      sku: dto.sku ?? product.sku,
      barcode: dto.barcode ?? product.barcode,
      category: dto.category ?? product.category,
      unit: dto.unit ?? product.unit,
      purchase_price: dto.purchasePrice ?? product.purchase_price,
      selling_price: dto.sellingPrice ?? product.selling_price,
      tax_percentage: dto.taxPercentage ?? product.tax_percentage,
      stock_quantity: dto.stockQuantity ?? product.stock_quantity,
      batch_number: dto.batchNumber ?? product.batch_number,
      expiry_date: dto.expiryDate ? new Date(dto.expiryDate) : product.expiry_date,
      description: dto.description !== undefined ? dto.description : product.description,
      is_available: dto.isAvailable !== undefined ? dto.isAvailable : product.is_available,
    });
    return this.productsRepository.save(product);
  }

  async remove(id: string, businessId: string) {
    const product = await this.findOne(id, businessId);
    await this.productsRepository.remove(product);
    return { deleted: true };
  }

  async adjustStock(id: string, businessId: string, delta: number) {
    const product = await this.findOne(id, businessId);
    product.stock_quantity = Number(product.stock_quantity) + delta;
    return this.productsRepository.save(product);
  }
}

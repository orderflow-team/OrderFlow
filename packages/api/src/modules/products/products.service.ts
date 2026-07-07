import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity';
import { ProductVariant } from '../../database/entities/product-variant.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductWithVariantsDto } from './dto/create-product-with-variants.dto';
import { enforceMrpCeiling } from './utils/pricing.util';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  create(dto: CreateProductDto) {
    const product = this.productsRepository.create({
      business_id: dto.businessId,
      name: dto.name,
      brand: dto.brand,
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
      generic_name: dto.genericName,
      prescription_required: dto.prescriptionRequired ?? false,
      description: dto.description,
      is_available: dto.isAvailable ?? true,
      is_draft: dto.isDraft ?? false,
      unit_prices: dto.unitPrices ?? null,
    });
    return this.productsRepository.save(product);
  }

  /**
   * Quick-Add: creates a master product together with its packaging/pricing
   * variants (e.g. 350ml / 1Ltr / 5Ltr of the same oil) in a single
   * transaction. If any variant fails to save, the whole product creation —
   * including the master row — rolls back.
   */
  async createWithVariants(dto: CreateProductWithVariantsDto) {
    return this.dataSource.transaction(async (manager) => {
      // MRP ceiling guardrail applied per-variant before anything is persisted.
      const variantInputs = dto.variants.map((v) => ({
        ...v,
        sellingPrice: enforceMrpCeiling(v.sellingPrice, v.mrp),
      }));

      const product = manager.create(Product, {
        business_id: dto.businessId,
        name: dto.name,
        brand: dto.brand,
        category: dto.category,
        tax_percentage: dto.taxPercentage ?? 0,
        description: dto.description,
        // The master product keeps a representative price (from the first
        // variant) for legacy single-price flows; the real price matrix
        // lives on product_variants.
        purchase_price: variantInputs[0].costPrice,
        selling_price: variantInputs[0].sellingPrice,
        stock_quantity: variantInputs.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0),
        is_available: true,
      });
      const savedProduct = await manager.save(Product, product);

      const variants = variantInputs.map((v) =>
        manager.create(ProductVariant, {
          business_id: dto.businessId,
          product_id: savedProduct.id,
          name: v.name,
          volume_value: v.volumeValue,
          uom: v.uom,
          sku: v.sku,
          barcode: v.barcode,
          cost_price: v.costPrice,
          mrp: v.mrp,
          selling_price: v.sellingPrice,
          stock_quantity: v.stockQuantity ?? 0,
          is_available: v.isAvailable ?? true,
        }),
      );
      const savedVariants = await manager.save(ProductVariant, variants);

      return { ...savedProduct, variants: savedVariants };
    });
  }

  findAll(businessId: string, search?: string, isDraft?: string) {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_archived = false');

    if (isDraft !== undefined && isDraft !== 'all') {
      query.andWhere('product.is_draft = :isDraft', { isDraft: isDraft === 'true' });
    } else if (isDraft === undefined) {
      query.andWhere('product.is_draft = false'); // default to non-drafts
    }

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
      brand: dto.brand ?? product.brand,
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
      generic_name: dto.genericName ?? product.generic_name,
      prescription_required: dto.prescriptionRequired !== undefined ? dto.prescriptionRequired : product.prescription_required,
      description: dto.description !== undefined ? dto.description : product.description,
      is_available: dto.isAvailable !== undefined ? dto.isAvailable : product.is_available,
      is_draft: dto.isDraft !== undefined ? dto.isDraft : product.is_draft,
      unit_prices: dto.unitPrices !== undefined ? dto.unitPrices : product.unit_prices,
    });
    return this.productsRepository.save(product);
  }

  async remove(id: string, businessId: string) {
    const product = await this.findOne(id, businessId);
    try {
      await this.productsRepository.remove(product);
      return { deleted: true };
    } catch (error) {
      // If hard delete fails (e.g. foreign key constraint from order_items), soft delete it
      product.is_archived = true;
      await this.productsRepository.save(product);
      return { deleted: true, softDeleted: true };
    }
  }

  async adjustStock(id: string, businessId: string, delta: number) {
    const product = await this.findOne(id, businessId);
    product.stock_quantity = Number(product.stock_quantity) + delta;
    return this.productsRepository.save(product);
  }
}

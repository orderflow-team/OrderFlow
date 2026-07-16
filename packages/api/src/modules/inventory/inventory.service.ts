import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Product } from '../../database/entities/product.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(PurchaseOrder) private purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseItem) private purchaseItemsRepository: Repository<PurchaseItem>,
    @InjectRepository(Stock) private stocksRepository: Repository<Stock>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const purchaseOrder = manager.create(PurchaseOrder, {
        business_id: dto.businessId,
        supplier_id: dto.supplierId,
        order_number: dto.orderNumber ?? `PO-${Date.now()}`,
        status: 'draft',
        total_amount: totalAmount,
      });
      const saved = await manager.save(purchaseOrder);

      const items = dto.items.map((item) =>
        manager.create(PurchaseItem, {
          purchase_order_id: saved.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          batch_number: item.batchNumber,
          expiry_date: item.expiryDate ? new Date(item.expiryDate) : undefined,
          scheme_quantity: item.schemeQuantity,
        }),
      );
      await manager.save(PurchaseItem, items);

      return { ...saved, items };
    });
  }

  findAllPurchaseOrders(businessId: string, status?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (status) {
      where.status = status;
    }
    return this.purchaseOrdersRepository.find({ 
      where, 
      order: { created_at: 'DESC' },
      relations: { items: { product: true } }
    });
  }

  async findOnePurchaseOrder(id: string, businessId: string) {
    const order = await this.purchaseOrdersRepository.findOne({ where: { id, business_id: businessId } });
    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }
    const items = await this.purchaseItemsRepository.find({ where: { purchase_order_id: id } });
    return { ...order, items };
  }

  /**
   * Receiving a purchase order stocks-in each item and bumps product
   * stock_quantity. The status flip to 'received' is done as a single
   * conditional UPDATE (not read-then-write) so two concurrent requests
   * can't both pass the "not yet received" check and double-credit stock.
   */
  async receivePurchaseOrder(id: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const updateResult = await manager
        .createQueryBuilder()
        .update(PurchaseOrder)
        .set({ status: 'received' })
        .where('id = :id AND business_id = :businessId AND status != :received', {
          id,
          businessId,
          received: 'received',
        })
        .execute();

      if (updateResult.affected === 0) {
        const exists = await manager.findOne(PurchaseOrder, { where: { id, business_id: businessId } });
        if (!exists) {
          throw new NotFoundException('Purchase order not found');
        }
        throw new BadRequestException('Purchase order already received');
      }

      const order = await manager.findOne(PurchaseOrder, { where: { id, business_id: businessId } });
      if (!order) {
        throw new NotFoundException('Purchase order not found');
      }

      const items = await manager.find(PurchaseItem, { where: { purchase_order_id: id } });

      for (const item of items) {
        if (item.product_id) {
          await manager.increment(Product, { id: item.product_id }, 'stock_quantity', Number(item.quantity));
          // Latest received batch/expiry becomes the product's current batch/expiry.
          if (item.batch_number || item.expiry_date) {
            await manager.update(
              Product,
              { id: item.product_id },
              {
                ...(item.batch_number ? { batch_number: item.batch_number } : {}),
                ...(item.expiry_date ? { expiry_date: item.expiry_date } : {}),
              },
            );
          }
        }
        const stock = manager.create(Stock, {
          business_id: businessId,
          product_id: item.product_id,
          type: 'IN',
          quantity: Number(item.quantity),
          reference: order.order_number,
          notes: 'Purchase order received',
        });
        await manager.save(stock);
      }

      return order;
    });
  }

  async adjustStock(dto: AdjustStockDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: dto.productId, business_id: dto.businessId },
      });
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const delta = dto.type === 'IN' ? dto.quantity : -dto.quantity;
      if (dto.type === 'OUT' && Number(product.stock_quantity) < dto.quantity) {
        throw new BadRequestException('Insufficient stock for this adjustment');
      }

      await manager.increment(Product, { id: product.id }, 'stock_quantity', delta);

      const stock = manager.create(Stock, {
        business_id: dto.businessId,
        product_id: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        reference: dto.reference,
        notes: dto.notes,
      });
      return manager.save(stock);
    });
  }

  findStockHistory(businessId: string, productId?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (productId) {
      where.product_id = productId;
    }
    return this.stocksRepository.find({ where, order: { created_at: 'DESC' } });
  }

  lowStock(businessId: string, threshold = 10) {
    return this.productsRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.stock_quantity <= :threshold', { threshold })
      .orderBy('product.stock_quantity', 'ASC')
      .getMany();
  }
}

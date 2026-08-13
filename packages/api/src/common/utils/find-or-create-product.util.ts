import { EntityManager } from 'typeorm';
import { Product } from '../../database/entities/product.entity';

/**
 * Looks up a Product by name (case-insensitive) within a business; creates a
 * draft one from the given price/unit/tax if none exists yet. Same
 * find-or-create-by-name behavior OrdersService uses for Quick Parchi free-text
 * items — reused here so a cross-tenant synced Order/PurchaseOrder (see
 * business-connections order-sync hooks) always has a real Product to attach
 * to, even though the counterpart business's Product row can't be reused
 * directly (products are scoped per-business).
 */
export async function findOrCreateProductByName(
  manager: EntityManager,
  businessId: string,
  name: string,
  unit: string | undefined,
  price: number,
  taxPercentage: number,
): Promise<Product> {
  const existing = await manager
    .getRepository(Product)
    .createQueryBuilder('product')
    .where('product.business_id = :businessId', { businessId })
    .andWhere('LOWER(product.name) = LOWER(:name)', { name })
    .getOne();

  if (existing) {
    return existing;
  }

  const created = manager.create(Product, {
    business_id: businessId,
    name,
    unit: unit ?? 'piece',
    purchase_price: 0,
    selling_price: price,
    tax_percentage: taxPercentage,
    stock_quantity: 0,
    is_draft: false,
  });
  return manager.save(Product, created);
}

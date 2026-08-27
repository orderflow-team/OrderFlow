import { findOrCreateProductByName } from './find-or-create-product.util';
import { Product } from '../../database/entities/product.entity';

describe('findOrCreateProductByName', () => {
  const buildManager = (existing: any) => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existing),
    };
    return {
      getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(qb) }),
      create: jest.fn((_entity, data) => ({ id: 'new-id', ...data })),
      save: jest.fn(async (_entity, data) => data),
      __qb: qb,
    };
  };

  it('returns the existing product when a case-insensitive name match is found', async () => {
    const existing = { id: 'p1', name: 'Widget' };
    const manager = buildManager(existing);

    const result = await findOrCreateProductByName(manager as any, 'biz-1', 'widget', 'piece', 10, 5);

    expect(result).toBe(existing);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('creates a draft product with the given price/unit/tax when none exists', async () => {
    const manager = buildManager(null);

    const result = await findOrCreateProductByName(manager as any, 'biz-1', 'New Item', 'kg', 25, 12);

    expect(manager.create).toHaveBeenCalledWith(
      Product,
      expect.objectContaining({
        business_id: 'biz-1',
        name: 'New Item',
        unit: 'kg',
        selling_price: 25,
        tax_percentage: 12,
        purchase_price: 0,
        stock_quantity: 0,
        is_draft: false,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ name: 'New Item' }));
  });

  it('defaults the unit to "piece" when none is given', async () => {
    const manager = buildManager(null);

    await findOrCreateProductByName(manager as any, 'biz-1', 'New Item', undefined, 25, 0);

    expect(manager.create).toHaveBeenCalledWith(Product, expect.objectContaining({ unit: 'piece' }));
  });
});

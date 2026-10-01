import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderItemDto } from './create-order.dto';

const check = (plain: object) => validate(plainToInstance(CreateOrderItemDto, plain));

describe('CreateOrderItemDto limits', () => {
  it('accepts a normal item', async () => {
    expect(await check({ customProductName: 'Chai', quantity: 2, unitPrice: 15 })).toHaveLength(0);
  });

  it('accepts the maximum quantity and price', async () => {
    expect(await check({ customProductName: 'x', quantity: 1_000_000, unitPrice: 10_000_000 })).toHaveLength(0);
  });

  it('rejects a quantity that would overflow the decimal(15,2) columns', async () => {
    const errors = await check({ customProductName: 'x', quantity: 1e15 });
    expect(errors.map((e) => e.property)).toContain('quantity');
  });

  it('rejects an absurd unitPrice', async () => {
    const errors = await check({ customProductName: 'x', quantity: 1, unitPrice: 1e12 });
    expect(errors.map((e) => e.property)).toContain('unitPrice');
  });

  it('still rejects zero or negative quantity and negative price', async () => {
    expect((await check({ customProductName: 'x', quantity: 0 })).map((e) => e.property)).toContain('quantity');
    expect((await check({ customProductName: 'x', quantity: 1, unitPrice: -1 })).map((e) => e.property)).toContain('unitPrice');
  });
});

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { ContainerLedger } from '../../database/entities/container-ledger.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Product } from '../../database/entities/product.entity';
import { pendingEmpties } from './container-balance.util';
import { RecordReturnDto } from './dto/record-return.dto';

export interface PendingEmpties {
  productId: string;
  productName: string;
  pending: number;
}

@Injectable()
export class ContainersService {
  constructor(
    @InjectRepository(ContainerLedger) private ledger: Repository<ContainerLedger>,
    @InjectRepository(Customer) private customers: Repository<Customer>,
    @InjectRepository(Product) private products: Repository<Product>,
  ) {}

  /** Records empties handed back outside an order (a drop-off, or a delivery person's phone entry). */
  async recordReturn(dto: RecordReturnDto) {
    const [customer, product] = await Promise.all([
      this.customers.findOne({ where: { id: dto.customerId, business_id: dto.businessId } }),
      this.products.findOne({ where: { id: dto.productId, business_id: dto.businessId } }),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');
    if (!product) throw new NotFoundException('Product not found');
    if (!product.is_returnable) throw new BadRequestException('This product is not a returnable container');

    try {
      await this.ledger.save(
        this.ledger.create({
          business_id: dto.businessId,
          customer_id: dto.customerId,
          product_id: dto.productId,
          type: 'returned',
          quantity: dto.quantity,
          note: dto.note ?? null,
          client_request_id: dto.clientRequestId ?? null,
        }),
      );
    } catch (error) {
      // A retried offline sync of the same queued return: already recorded, not an error.
      const code = error instanceof QueryFailedError ? (error as any).driverError?.code : undefined;
      if (!(dto.clientRequestId && code === '23505')) throw error;
    }
    return { customerId: dto.customerId, pending: await this.pendingForCustomer(dto.businessId, dto.customerId) };
  }

  /** Writes the ledger rows for one order; called inside the order's own transaction. */
  async recordOrderMovements(
    manager: EntityManager,
    params: {
      businessId: string;
      customerId: string;
      orderId: string;
      lines: Array<{ productId: string; delivered: number; returned: number }>;
    },
  ) {
    const rows = params.lines.flatMap((l) => [
      ...(l.delivered > 0 ? [{ type: 'delivered' as const, productId: l.productId, quantity: l.delivered }] : []),
      ...(l.returned > 0 ? [{ type: 'returned' as const, productId: l.productId, quantity: l.returned }] : []),
    ]);
    if (rows.length === 0) return;
    await manager.insert(
      ContainerLedger,
      rows.map((r) => ({
        business_id: params.businessId,
        customer_id: params.customerId,
        product_id: r.productId,
        type: r.type,
        quantity: r.quantity,
        order_id: params.orderId,
      })),
    );
  }

  async removeOrderMovements(manager: EntityManager, orderId: string) {
    await manager.delete(ContainerLedger, { order_id: orderId });
  }

  async pendingForCustomer(businessId: string, customerId: string): Promise<PendingEmpties[]> {
    const rows = await this.ledger.find({ where: { business_id: businessId, customer_id: customerId } });
    return this.summarize(businessId, rows);
  }

  /** Customers who still hold empties, most first: the "who do I chase" list. */
  async report(businessId: string) {
    const rows = await this.ledger.find({ where: { business_id: businessId } });
    const byCustomer = new Map<string, ContainerLedger[]>();
    for (const r of rows) {
      const list = byCustomer.get(r.customer_id) ?? [];
      list.push(r);
      byCustomer.set(r.customer_id, list);
    }
    if (byCustomer.size === 0) return [];
    const customers = await this.customers.find({ where: { business_id: businessId } });
    const names = new Map(customers.map((c) => [c.id, c]));
    const out: Array<{ customerId: string; customerName: string; phone: string | null; total: number; items: PendingEmpties[] }> = [];
    for (const [customerId, list] of byCustomer) {
      const items = await this.summarize(businessId, list);
      const total = items.reduce((s, i) => s + i.pending, 0);
      if (total <= 0) continue;
      const c = names.get(customerId);
      out.push({ customerId, customerName: c?.name ?? 'Unknown', phone: c?.phone ?? null, total, items });
    }
    return out.sort((a, b) => b.total - a.total);
  }

  private async summarize(businessId: string, rows: ContainerLedger[]): Promise<PendingEmpties[]> {
    const byProduct = new Map<string, ContainerLedger[]>();
    for (const r of rows) {
      const list = byProduct.get(r.product_id) ?? [];
      list.push(r);
      byProduct.set(r.product_id, list);
    }
    if (byProduct.size === 0) return [];
    const products = await this.products.find({ where: { business_id: businessId } });
    const names = new Map(products.map((p) => [p.id, p.name]));
    return [...byProduct.entries()]
      .map(([productId, list]) => ({ productId, productName: names.get(productId) ?? 'Item', pending: pendingEmpties(list) }))
      .filter((i) => i.pending > 0);
  }
}

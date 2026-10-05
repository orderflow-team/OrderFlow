import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Expense } from '../../database/entities/expense.entity';

const UNBILLED_ORDER_STATUSES = ['draft', 'cancelled', 'returned'];

/** 'Credit' is a label-only payment method: it never moves money or reduces what a customer owes. */
const NON_CASH_PAYMENT_METHOD = 'Credit';

export const AGEING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

export function bucketForAge(ageDays: number): AgeingBucket {
  if (ageDays <= 30) return '0-30';
  if (ageDays <= 60) return '31-60';
  if (ageDays <= 90) return '61-90';
  return '90+';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Parses a yyyy-mm-dd (or full ISO) string; a bare date as `to` means the END of that day. */
export function parseRange(from?: string, to?: string): { start: Date; end: Date } {
  const parse = (value: string, endOfDay: boolean): Date => {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = new Date(isDateOnly ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}` : value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
    return d;
  };
  const now = new Date();
  const start = from ? parse(from, false) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = to ? parse(to, true) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (start > end) throw new BadRequestException('"from" must be on or before "to"');
  return { start, end };
}

/**
 * Splits `outstanding` across `documents` (newest first), so the dues land on the most recent
 * bills — payments are assumed to clear the oldest bills first. Returns only the unpaid slices.
 */
export function allocateOutstanding<T extends { total: number }>(
  documents: T[],
  outstanding: number,
): Array<T & { due: number }> {
  let remaining = outstanding;
  const result: Array<T & { due: number }> = [];
  for (const doc of documents) {
    if (remaining <= 0.005) break;
    const due = Math.min(doc.total, remaining);
    remaining -= due;
    result.push({ ...doc, due: round2(due) });
  }
  return result;
}

@Injectable()
export class LedgerReportsService {
  constructor(
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(Supplier) private suppliersRepository: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    @InjectRepository(Expense) private expensesRepository: Repository<Expense>,
  ) {}

  /** Everything that happened in the period, in time order, with money-in / money-out totals. */
  async dayBook(businessId: string, from?: string, to?: string) {
    const { start, end } = parseRange(from, to);

    const [orders, payments, expenses, purchases] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('o')
        .where('o.business_id = :businessId', { businessId })
        .andWhere('o.status NOT IN (:...excluded)', { excluded: UNBILLED_ORDER_STATUSES })
        .andWhere('o.created_at BETWEEN :start AND :end', { start, end })
        .getMany(),
      this.paymentsRepository
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.order', 'order')
        .where('p.business_id = :businessId', { businessId })
        .andWhere("p.status = 'completed'")
        .andWhere('p.payment_method IS DISTINCT FROM :credit', { credit: NON_CASH_PAYMENT_METHOD })
        .andWhere('p.created_at BETWEEN :start AND :end', { start, end })
        .getMany(),
      this.expensesRepository
        .createQueryBuilder('e')
        .where('e.business_id = :businessId', { businessId })
        .andWhere('e.created_at BETWEEN :start AND :end', { start, end })
        .getMany(),
      this.purchaseOrdersRepository
        .createQueryBuilder('po')
        .leftJoinAndSelect('po.supplier', 'supplier')
        .where('po.business_id = :businessId', { businessId })
        .andWhere("po.status IN ('received', 'paid')")
        .andWhere('po.updated_at BETWEEN :start AND :end', { start, end })
        .getMany(),
    ]);

    type Entry = {
      at: Date;
      type: 'sale' | 'payment' | 'expense' | 'purchase';
      reference: string;
      party: string;
      description: string;
      moneyIn: number;
      moneyOut: number;
      saleAmount: number;
    };
    const entries: Entry[] = [
      ...orders.map((o): Entry => ({
        at: o.created_at,
        type: 'sale',
        reference: o.order_number,
        party: o.customer_name || 'Walk-in',
        description: `Sale (${o.status})`,
        moneyIn: 0,
        moneyOut: 0,
        saleAmount: Number(o.total_amount),
      })),
      ...payments.map((p): Entry => ({
        at: p.created_at,
        type: 'payment',
        reference: p.order?.order_number || p.transaction_id || '',
        party: p.order?.customer_name || 'Walk-in',
        description: `Payment received${p.payment_method ? ` (${p.payment_method})` : ''}`,
        moneyIn: Number(p.amount),
        moneyOut: 0,
        saleAmount: 0,
      })),
      ...expenses.map((e): Entry => ({
        at: e.created_at,
        type: 'expense',
        reference: '',
        party: e.category || 'Expense',
        description: e.description || 'Expense',
        moneyIn: 0,
        moneyOut: Number(e.amount),
        saleAmount: 0,
      })),
      ...purchases.map((po): Entry => ({
        at: po.updated_at,
        type: 'purchase',
        reference: po.order_number,
        party: po.supplier?.name || 'Supplier',
        description: `Purchase (${po.status})`,
        moneyIn: 0,
        moneyOut: Number(po.total_amount),
        saleAmount: 0,
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    const totals = entries.reduce(
      (acc, e) => ({
        sales: acc.sales + e.saleAmount,
        moneyIn: acc.moneyIn + e.moneyIn,
        moneyOut: acc.moneyOut + e.moneyOut,
      }),
      { sales: 0, moneyIn: 0, moneyOut: 0 },
    );

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      entries: entries.map((e) => ({
        ...e,
        at: e.at.toISOString(),
        moneyIn: round2(e.moneyIn),
        moneyOut: round2(e.moneyOut),
        saleAmount: round2(e.saleAmount),
      })),
      totals: {
        sales: round2(totals.sales),
        moneyIn: round2(totals.moneyIn),
        moneyOut: round2(totals.moneyOut),
        net: round2(totals.moneyIn - totals.moneyOut),
      },
    };
  }

  /** Who owes you (customers) or whom you owe (suppliers), with the dues aged by bill date. */
  async ageing(businessId: string, kind: 'receivable' | 'payable') {
    const now = Date.now();
    const empty = () => ({ '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }) as Record<AgeingBucket, number>;
    const buckets = empty();

    const parties =
      kind === 'receivable'
        ? await this.customersRepository
            .createQueryBuilder('c')
            .where('c.business_id = :businessId', { businessId })
            .andWhere('c.outstanding_amount > 0')
            .orderBy('c.outstanding_amount', 'DESC')
            .getMany()
        : await this.suppliersRepository
            .createQueryBuilder('s')
            .where('s.business_id = :businessId', { businessId })
            .andWhere('s.outstanding_amount > 0')
            .orderBy('s.outstanding_amount', 'DESC')
            .getMany();

    const rows = [] as Array<{
      id: string;
      name: string;
      phone: string | null;
      outstanding: number;
      oldestDueDays: number;
      buckets: Record<AgeingBucket, number>;
    }>;

    for (const party of parties) {
      const outstanding = Number(party.outstanding_amount);
      const docs =
        kind === 'receivable'
          ? (
              await this.ordersRepository
                .createQueryBuilder('o')
                .where('o.business_id = :businessId AND o.customer_id = :id', { businessId, id: party.id })
                .andWhere('o.status NOT IN (:...excluded)', { excluded: UNBILLED_ORDER_STATUSES })
                .orderBy('o.created_at', 'DESC')
                .limit(500)
                .getMany()
            ).map((o) => ({ at: o.created_at, total: Number(o.total_amount) }))
          : (
              await this.purchaseOrdersRepository
                .createQueryBuilder('po')
                .where('po.business_id = :businessId AND po.supplier_id = :id', { businessId, id: party.id })
                .andWhere("po.status IN ('received', 'paid')")
                .orderBy('po.created_at', 'DESC')
                .limit(500)
                .getMany()
            ).map((po) => ({ at: po.created_at, total: Number(po.total_amount) }));

      const partyBuckets = empty();
      let oldest = 0;
      for (const slice of allocateOutstanding(docs, outstanding)) {
        const age = Math.max(0, Math.floor((now - slice.at.getTime()) / 86_400_000));
        partyBuckets[bucketForAge(age)] += slice.due;
        oldest = Math.max(oldest, age);
      }
      // Dues older than the 500 most recent bills (or opening balances with no bill) — oldest bucket.
      const allocated = Object.values(partyBuckets).reduce((a, b) => a + b, 0);
      if (outstanding - allocated > 0.01) {
        partyBuckets['90+'] += outstanding - allocated;
        oldest = Math.max(oldest, 91);
      }

      for (const b of AGEING_BUCKETS) {
        partyBuckets[b] = round2(partyBuckets[b]);
        buckets[b] += partyBuckets[b];
      }
      rows.push({
        id: party.id,
        name: party.name,
        phone: party.phone || null,
        outstanding: round2(outstanding),
        oldestDueDays: oldest,
        buckets: partyBuckets,
      });
    }

    for (const b of AGEING_BUCKETS) buckets[b] = round2(buckets[b]);
    return {
      kind,
      total: round2(rows.reduce((sum, r) => sum + r.outstanding, 0)),
      buckets,
      parties: rows,
    };
  }

  /** Statement for one party: opening balance, every bill and payment in the period, closing balance. */
  async partyLedger(businessId: string, kind: 'customer' | 'supplier', partyId: string, from?: string, to?: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partyId || '')) {
      throw new BadRequestException('partyId must be a valid id');
    }
    const { start, end } = parseRange(from, to);

    const party =
      kind === 'customer'
        ? await this.customersRepository.findOne({ where: { id: partyId, business_id: businessId } })
        : await this.suppliersRepository.findOne({ where: { id: partyId, business_id: businessId } });
    if (!party) throw new NotFoundException(`${kind === 'customer' ? 'Customer' : 'Supplier'} not found`);

    type Row = { at: Date; description: string; reference: string; debit: number; credit: number };
    let rows: Row[];

    if (kind === 'customer') {
      const [orders, payments] = await Promise.all([
        this.ordersRepository
          .createQueryBuilder('o')
          .where('o.business_id = :businessId AND o.customer_id = :partyId', { businessId, partyId })
          .andWhere('o.status NOT IN (:...excluded)', { excluded: UNBILLED_ORDER_STATUSES })
          .getMany(),
        this.paymentsRepository
          .createQueryBuilder('p')
          .innerJoinAndSelect('p.order', 'order')
          .where('p.business_id = :businessId AND order.customer_id = :partyId', { businessId, partyId })
          .andWhere("p.status = 'completed'")
          .andWhere('p.payment_method IS DISTINCT FROM :credit', { credit: NON_CASH_PAYMENT_METHOD })
          .getMany(),
      ]);
      rows = [
        ...orders.map((o) => ({
          at: o.created_at,
          description: 'Sale',
          reference: o.order_number,
          debit: Number(o.total_amount),
          credit: 0,
        })),
        ...payments.map((p) => ({
          at: p.created_at,
          description: `Payment${p.payment_method ? ` (${p.payment_method})` : ''}`,
          reference: p.order?.order_number || '',
          debit: 0,
          credit: Number(p.amount),
        })),
      ];
    } else {
      const purchases = await this.purchaseOrdersRepository
        .createQueryBuilder('po')
        .where('po.business_id = :businessId AND po.supplier_id = :partyId', { businessId, partyId })
        .andWhere("po.status IN ('received', 'paid')")
        .getMany();
      // Supplier payments are only tracked as a running outstanding balance, not as rows,
      // so a supplier statement lists purchases and reconciles the rest as "payments made".
      rows = purchases.map((po) => ({
        at: po.created_at,
        description: 'Purchase',
        reference: po.order_number,
        debit: 0,
        credit: Number(po.total_amount),
      }));
    }

    rows.sort((a, b) => a.at.getTime() - b.at.getTime());

    // A customer owes (debit - credit); a supplier is owed (credit - debit). Positive = still due.
    const sign = kind === 'customer' ? 1 : -1;
    const net = (r: Row) => sign * (r.debit - r.credit);

    const opening = rows.filter((r) => r.at < start).reduce((sum, r) => sum + net(r), 0);
    let running = opening;
    const entries = rows
      .filter((r) => r.at >= start && r.at <= end)
      .map((r) => {
        running += net(r);
        return {
          at: r.at.toISOString(),
          description: r.description,
          reference: r.reference,
          debit: round2(r.debit),
          credit: round2(r.credit),
          balance: round2(running),
        };
      });

    return {
      kind,
      party: { id: party.id, name: party.name, phone: party.phone || null },
      from: start.toISOString(),
      to: end.toISOString(),
      openingBalance: round2(opening),
      entries,
      closingBalance: round2(running),
      // The balance the app actually tracks — differs from the computed closing balance when
      // the books were adjusted manually or cover activity outside this period.
      currentOutstanding: round2(Number(party.outstanding_amount)),
    };
  }
}

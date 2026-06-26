import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from '../../database/entities/payment.entity';
import { Ledger } from '../../database/entities/ledger.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Order } from '../../database/entities/order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    private dataSource: DataSource,
  ) {}

  /**
   * The customer's debt is normally posted when their order is confirmed
   * (see OrdersService.updateStatus). A Cash/UPI/Bank Transfer payment then
   * offsets that debt. A "Credit" payment records that the amount is being
   * deferred — it's a label only, since the debt already exists; it must
   * NOT also reduce outstanding_amount, or paid orders would go negative.
   *
   * Some flows (e.g. the restaurant "Close Bill" terminal) pay a `draft`
   * order directly, skipping the `confirmed` step — so the debit was never
   * posted. If we blindly decrement here, outstanding_amount goes negative.
   * Posting the missing debit first keeps the books correct either way.
   */
  async create(dto: CreatePaymentDto) {
    return this.dataSource.transaction(async (manager) => {
      const payment = manager.create(Payment, {
        business_id: dto.businessId,
        order_id: dto.orderId,
        amount: dto.amount,
        payment_method: dto.paymentMethod,
        status: 'completed',
        transaction_id: dto.transactionId,
      });
      const savedPayment = await manager.save(payment);

      let order: Order | null = null;
      if (dto.orderId) {
        order = await manager.findOne(Order, { where: { id: dto.orderId } });
      }

      if (dto.customerId) {
        const customer = await manager.findOne(Customer, { where: { id: dto.customerId } });
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }

        // Bill the order first if it skipped 'confirmed' (e.g. restaurant
        // "Close Bill" pays a draft order directly) — the debt must exist
        // before a payment (or a Credit deferral) can offset/reference it.
        if (order && order.status === 'draft') {
          await manager.increment(Customer, { id: dto.customerId }, 'outstanding_amount', Number(order.total_amount));
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: dto.businessId,
              customer_id: dto.customerId,
              type: 'DEBIT',
              amount: order.total_amount,
              description: `Order ${order.order_number} billed`,
            }),
          );
        }

        if (dto.paymentMethod !== 'Credit') {
          await manager.increment(Customer, { id: dto.customerId }, 'outstanding_amount', -dto.amount);

          const ledger = manager.create(Ledger, {
            business_id: dto.businessId,
            customer_id: dto.customerId,
            type: 'CREDIT',
            amount: dto.amount,
            description: `Payment received (${dto.paymentMethod})${dto.orderId ? ` - order ${dto.orderId}` : ''}`,
          });
          await manager.save(ledger);
        }
      }

      if (order) {
        const paid = await manager
          .createQueryBuilder(Payment, 'payment')
          .where('payment.order_id = :orderId', { orderId: dto.orderId })
          .select('SUM(payment.amount)', 'total')
          .getRawOne();
        if (Number(paid.total) >= Number(order.total_amount)) {
          order.status = 'paid';
          await manager.save(order);
        }
      }

      return savedPayment;
    });
  }

  findAll(businessId: string, orderId?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (orderId) {
      where.order_id = orderId;
    }
    return this.paymentsRepository.find({ where, order: { created_at: 'DESC' } });
  }
}

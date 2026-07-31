import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager, Like } from "typeorm";
import { Payment } from "../../database/entities/payment.entity";
import { Ledger } from "../../database/entities/ledger.entity";
import { Customer } from "../../database/entities/customer.entity";
import { Order } from "../../database/entities/order.entity";
import { Table } from "../../database/entities/table.entity";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PayTotalDto } from "./dto/pay-total.dto";
import { ApplyAdvanceDto } from "./dto/apply-advance.dto";

const BILLED_ORDER_STATUSES = [
  "confirmed",
  "packed",
  "dispatched",
  "delivered",
  "paid",
];
const UNBILLABLE_ORDER_STATUSES = ["cancelled", "returned"];

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    private dataSource: DataSource,
  ) {}

  /**
   * Applies a payment already capped to `amount <= order's remaining balance`
   * to a single order: bills the order first if it hasn't been billed yet
   * (e.g. restaurant "Close Bill" pays a draft order directly), posts the
   * customer ledger/outstanding_amount change, records the Payment row, and
   * flips the order to `paid` once fully covered. Shared by both the
   * single-order `create()` path and the multi-order `payAllOutstanding()`
   * bulk-pay path so both post identical accounting.
   */
  private async applyPaymentToOrder(
    manager: EntityManager,
    params: {
      businessId: string;
      order: Order;
      customerId?: string;
      amount: number;
      paymentMethod: string;
      transactionId?: string;
      clientRequestId?: string;
    },
  ): Promise<Payment> {
    const { businessId, order, customerId, amount, paymentMethod, transactionId, clientRequestId } = params;

    if (customerId) {
      const customer = await manager.findOne(Customer, {
        where: { id: customerId, business_id: businessId },
      });
      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      let willBillOrder = false;
      if (!BILLED_ORDER_STATUSES.includes(order.status)) {
        const billedCount = await manager.count(Ledger, {
          where: {
            business_id: businessId,
            customer_id: customerId,
            description: Like(`%Order ${order.order_number}%`),
          },
        });
        willBillOrder = billedCount === 0;
      }

      if (willBillOrder) {
        await manager.increment(
          Customer,
          { id: customerId },
          "outstanding_amount",
          Number(order.total_amount),
        );
        await manager.save(
          Ledger,
          manager.create(Ledger, {
            business_id: businessId,
            customer_id: customerId,
            type: "DEBIT",
            amount: order.total_amount,
            description: `Order ${order.order_number} billed`,
          }),
        );
      }

      if (paymentMethod !== "Credit") {
        await manager.increment(
          Customer,
          { id: customerId },
          "outstanding_amount",
          -amount,
        );
        await manager.save(
          Ledger,
          manager.create(Ledger, {
            business_id: businessId,
            customer_id: customerId,
            type: "CREDIT",
            amount,
            description: `Payment received (${paymentMethod}) - order ${order.id}`,
          }),
        );
      }
    }

    const payment = manager.create(Payment, {
      business_id: businessId,
      order_id: order.id,
      amount,
      payment_method: paymentMethod,
      status: "completed",
      transaction_id: transactionId,
      client_request_id: clientRequestId,
    });
    const savedPayment = await manager.save(payment);

    const paid = await manager
      .createQueryBuilder(Payment, "payment")
      .where("payment.order_id = :orderId", { orderId: order.id })
      .select("SUM(payment.amount)", "total")
      .getRawOne();
    if (Number(paid.total) >= Number(order.total_amount)) {
      order.status = "paid";
      await manager.save(order);
      if (order.table_id) {
        await manager.update(
          Table,
          { id: order.table_id },
          { status: "available" },
        );
      }
    }

    return savedPayment;
  }

  /**
   * Records `amount` as advance credit for a customer — money received that
   * doesn't correspond to any specific order's remaining balance (either the
   * leftover after a single-order overpayment, or after a bulk "pay total"
   * covers every outstanding order). Tracked separately from
   * outstanding_amount so it never pushes that figure negative, and surfaced
   * as its own Payment row (order_id null) so it still shows in payment history.
   */
  private async recordAdvance(
    manager: EntityManager,
    params: { businessId: string; customerId: string; amount: number; paymentMethod: string; transactionId?: string; description: string },
  ): Promise<Payment> {
    const { businessId, customerId, amount, paymentMethod, transactionId, description } = params;
    await manager.increment(Customer, { id: customerId }, "advance_balance", amount);
    await manager.save(
      Ledger,
      manager.create(Ledger, {
        business_id: businessId,
        customer_id: customerId,
        type: "CREDIT",
        amount,
        description,
      }),
    );
    return manager.save(
      Payment,
      manager.create(Payment, {
        business_id: businessId,
        order_id: null,
        amount,
        payment_method: paymentMethod,
        status: "completed",
        transaction_id: transactionId,
      }),
    );
  }

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
   *
   * If the amount paid against a specific order exceeds what's left on it,
   * the excess is never silently dropped — it's saved as advance credit on
   * the customer (see recordAdvance) so it can be applied to future orders.
   */
  async create(dto: CreatePaymentDto) {
    // Idempotency: the offline outbox (apps/web/lib/offline-db.ts) can retry a
    // queued payment if a prior sync succeeded server-side but the response
    // was lost — recognize the same clientRequestId instead of double-recording it.
    if (dto.clientRequestId) {
      const existing = await this.paymentsRepository.findOne({
        where: { business_id: dto.businessId, client_request_id: dto.clientRequestId },
      });
      if (existing) return existing;
    }
    return this.dataSource.transaction(async (manager) => {
      let order: Order | null = null;
      if (dto.orderId) {
        order = await manager.findOne(Order, {
          where: { id: dto.orderId, business_id: dto.businessId },
        });
        if (!order) {
          throw new NotFoundException("Order not found");
        }
      }

      if (!order) {
        // Pure customer-level payment, not tied to a specific order.
        if (dto.customerId) {
          const customer = await manager.findOne(Customer, {
            where: { id: dto.customerId, business_id: dto.businessId },
          });
          if (!customer) {
            throw new NotFoundException("Customer not found");
          }

          if (dto.paymentMethod !== "Credit") {
            if (dto.amount > Number(customer.outstanding_amount) + 0.01) {
              throw new BadRequestException(
                "Payment amount exceeds the outstanding balance",
              );
            }
            await manager.increment(
              Customer,
              { id: dto.customerId },
              "outstanding_amount",
              -dto.amount,
            );
            await manager.save(
              Ledger,
              manager.create(Ledger, {
                business_id: dto.businessId,
                customer_id: dto.customerId,
                type: "CREDIT",
                amount: dto.amount,
                description: `Payment received (${dto.paymentMethod})`,
              }),
            );
          }
        }

        const payment = manager.create(Payment, {
          business_id: dto.businessId,
          order_id: undefined,
          amount: dto.amount,
          payment_method: dto.paymentMethod,
          status: "completed",
          transaction_id: dto.transactionId,
          client_request_id: dto.clientRequestId,
        });
        return manager.save(payment);
      }

      const paidAgg = await manager
        .createQueryBuilder(Payment, "payment")
        .where("payment.order_id = :orderId", { orderId: order.id })
        .select("SUM(payment.amount)", "total")
        .getRawOne();
      const totalPaidSoFar = Number(paidAgg.total || 0);
      const orderRemaining = Math.max(
        0,
        Number(order.total_amount) - totalPaidSoFar,
      );

      let paymentAmount = dto.amount;
      let advanceAmount = 0;
      if (paymentAmount > orderRemaining) {
        advanceAmount = paymentAmount - orderRemaining;
        paymentAmount = orderRemaining;
      }

      const savedPayment = await this.applyPaymentToOrder(manager, {
        businessId: dto.businessId,
        order,
        customerId: dto.customerId,
        amount: paymentAmount,
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        clientRequestId: dto.clientRequestId,
      });

      if (advanceAmount > 0 && dto.customerId && dto.paymentMethod !== "Credit") {
        await this.recordAdvance(manager, {
          businessId: dto.businessId,
          customerId: dto.customerId,
          amount: advanceAmount,
          paymentMethod: dto.paymentMethod,
          transactionId: dto.transactionId,
          description: `Advance credit — overpayment on order ${order.order_number}`,
        });
      }

      return savedPayment;
    });
  }

  /**
   * "Pay Total" — a single amount from the customer, allocated across all of
   * their outstanding orders (oldest first) instead of paying each order one
   * at a time. Any amount left over after every order is fully covered is
   * saved as advance credit rather than rejected or dropped.
   */
  async payAllOutstanding(dto: PayTotalDto) {
    if (dto.clientRequestId) {
      const existing = await this.paymentsRepository.findOne({
        where: { business_id: dto.businessId, client_request_id: dto.clientRequestId },
      });
      if (existing) return { payments: [existing], advanceApplied: 0 };
    }
    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id: dto.customerId, business_id: dto.businessId },
      });
      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      const orders = await manager.find(Order, {
        where: { business_id: dto.businessId, customer_id: dto.customerId },
        order: { created_at: "ASC" },
      });

      let remaining = dto.amount;
      const payments: Payment[] = [];

      for (const order of orders) {
        if (remaining <= 0) break;
        if (UNBILLABLE_ORDER_STATUSES.includes(order.status)) continue;

        const paidAgg = await manager
          .createQueryBuilder(Payment, "payment")
          .where("payment.order_id = :orderId", { orderId: order.id })
          .select("SUM(payment.amount)", "total")
          .getRawOne();
        const orderRemaining = Math.max(
          0,
          Number(order.total_amount) - Number(paidAgg.total || 0),
        );
        if (orderRemaining <= 0) continue;

        const chunk = Math.min(remaining, orderRemaining);
        remaining -= chunk;

        payments.push(
          await this.applyPaymentToOrder(manager, {
            businessId: dto.businessId,
            order,
            customerId: dto.customerId,
            amount: chunk,
            paymentMethod: dto.paymentMethod,
            transactionId: dto.transactionId,
          }),
        );
      }

      let advanceApplied = 0;
      if (remaining > 0 && dto.paymentMethod !== "Credit") {
        advanceApplied = remaining;
        payments.push(
          await this.recordAdvance(manager, {
            businessId: dto.businessId,
            customerId: dto.customerId,
            amount: remaining,
            paymentMethod: dto.paymentMethod,
            transactionId: dto.transactionId,
            description: "Advance credit — payment exceeded total outstanding",
          }),
        );
      }

      if (payments.length === 0) {
        throw new BadRequestException("No outstanding orders to pay.");
      }

      // Tag the first payment row with the idempotency key so a retried
      // sync of this same bulk payment is recognized on replay.
      if (dto.clientRequestId) {
        payments[0].client_request_id = dto.clientRequestId;
        await manager.save(payments[0]);
      }

      return { payments, advanceApplied };
    });
  }

  /**
   * Reverses a single payment against an order — deletes the Payment row and
   * unwinds whatever it did to the customer's balances, so "undo" leaves the
   * books exactly as if that payment had never been recorded:
   *  - Cash/UPI/Bank Transfer: the amount goes back onto outstanding_amount.
   *  - Advance Credit: both outstanding_amount AND advance_balance are
   *    restored, since applying advance credit had moved money out of one
   *    and into the other.
   *  - Credit (label-only, never touched outstanding_amount): nothing to
   *    unwind but the row itself.
   * If the order had been flipped to 'paid' by this payment, it's reverted
   * to 'confirmed' once the remaining balance is no longer fully covered.
   */
  async undo(paymentId: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId, business_id: businessId },
      });
      if (!payment) {
        throw new NotFoundException("Payment not found");
      }
      if (!payment.order_id) {
        throw new BadRequestException("This payment isn't tied to an order and can't be undone here.");
      }
      const amount = Number(payment.amount);
      if (amount <= 0) {
        throw new BadRequestException("This payment can't be undone.");
      }

      const order = await manager.findOne(Order, {
        where: { id: payment.order_id, business_id: businessId },
      });
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.customer_id) {
        if (payment.payment_method === "Advance Credit") {
          await manager.increment(Customer, { id: order.customer_id }, "advance_balance", amount);
          await manager.increment(Customer, { id: order.customer_id }, "outstanding_amount", amount);
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: businessId,
              customer_id: order.customer_id,
              type: "DEBIT",
              amount,
              description: `Advance credit payment undone on order ${order.order_number}`,
            }),
          );
        } else if (payment.payment_method !== "Credit") {
          await manager.increment(Customer, { id: order.customer_id }, "outstanding_amount", amount);
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: businessId,
              customer_id: order.customer_id,
              type: "DEBIT",
              amount,
              description: `Payment undone on order ${order.order_number} (${payment.payment_method})`,
            }),
          );
        }
      }

      await manager.remove(payment);

      const paidAgg = await manager
        .createQueryBuilder(Payment, "payment")
        .where("payment.order_id = :orderId", { orderId: order.id })
        .select("SUM(payment.amount)", "total")
        .getRawOne();
      const stillFullyPaid = Number(paidAgg.total || 0) >= Number(order.total_amount) - 0.01;
      if (order.status === "paid" && !stillFullyPaid) {
        order.status = "confirmed";
        await manager.save(order);
      }

      return { undone: true, orderId: order.id, orderStatus: order.status };
    });
  }

  /**
   * Draws down a customer's existing advance credit against their currently
   * outstanding orders (oldest first) — for credit that predates the debt
   * (e.g. built up while every order happened to already be settled), where
   * the automatic draw-down in OrdersService.applyAdvanceCredit never had a
   * balance to apply it to at billing time.
   */
  async applyAdvanceToOutstanding(dto: ApplyAdvanceDto) {
    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id: dto.customerId, business_id: dto.businessId },
      });
      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      let advanceRemaining = Number(customer.advance_balance);
      if (advanceRemaining <= 0) {
        throw new BadRequestException("This customer has no advance credit to apply.");
      }

      const orders = await manager.find(Order, {
        where: { business_id: dto.businessId, customer_id: dto.customerId },
        order: { created_at: "ASC" },
      });

      let applied = 0;
      const payments: Payment[] = [];

      for (const order of orders) {
        if (advanceRemaining <= 0) break;
        if (UNBILLABLE_ORDER_STATUSES.includes(order.status)) continue;

        const paidAgg = await manager
          .createQueryBuilder(Payment, "payment")
          .where("payment.order_id = :orderId", { orderId: order.id })
          .select("SUM(payment.amount)", "total")
          .getRawOne();
        const orderRemaining = Math.max(
          0,
          Number(order.total_amount) - Number(paidAgg.total || 0),
        );
        if (orderRemaining <= 0) continue;

        const chunk = Math.min(advanceRemaining, orderRemaining);
        advanceRemaining -= chunk;
        applied += chunk;

        payments.push(
          await this.applyPaymentToOrder(manager, {
            businessId: dto.businessId,
            order,
            customerId: dto.customerId,
            amount: chunk,
            paymentMethod: "Advance Credit",
          }),
        );
      }

      if (payments.length === 0) {
        throw new BadRequestException("No outstanding orders to apply advance credit to.");
      }

      await manager.increment(Customer, { id: dto.customerId }, "advance_balance", -applied);

      return { applied, payments };
    });
  }

  async findAll(businessId: string, orderId?: string, customerId?: string) {
    const qb = this.paymentsRepository
      .createQueryBuilder("p")
      .where("p.business_id = :businessId", { businessId });

    if (orderId) {
      qb.andWhere("p.order_id = :orderId", { orderId });
    }

    if (customerId) {
      qb.innerJoin("p.order", "o").andWhere("o.customer_id = :customerId", {
        customerId,
      });
    }

    return qb.orderBy("p.created_at", "DESC").getMany();
  }
}

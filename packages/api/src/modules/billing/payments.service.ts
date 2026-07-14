import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, Like } from "typeorm";
import { Payment } from "../../database/entities/payment.entity";
import { Ledger } from "../../database/entities/ledger.entity";
import { Customer } from "../../database/entities/customer.entity";
import { Order } from "../../database/entities/order.entity";
import { Table } from "../../database/entities/table.entity";
import { CreatePaymentDto } from "./dto/create-payment.dto";

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
      let order: Order | null = null;
      if (dto.orderId) {
        order = await manager.findOne(Order, {
          where: { id: dto.orderId, business_id: dto.businessId },
        });
        if (!order) {
          throw new NotFoundException("Order not found");
        }
      }

      let paymentAmount = dto.amount;
      if (order) {
        const paid = await manager
          .createQueryBuilder(Payment, "payment")
          .where("payment.order_id = :orderId", { orderId: order.id })
          .select("SUM(payment.amount)", "total")
          .getRawOne();
        const totalPaidSoFar = Number(paid.total || 0);
        const orderRemaining = Math.max(
          0,
          Number(order.total_amount) - totalPaidSoFar,
        );

        if (paymentAmount > orderRemaining) {
          paymentAmount = orderRemaining;
        }
      }

      if (dto.customerId) {
        const customer = await manager.findOne(Customer, {
          where: { id: dto.customerId, business_id: dto.businessId },
        });
        if (!customer) {
          throw new NotFoundException("Customer not found");
        }

        // Bill the order first if it hasn't been billed yet (e.g. restaurant
        // "Close Bill" pays a draft order directly, or order skipped confirmed state).
        let willBillOrder = false;
        if (order) {
          const billedStatuses = [
            "confirmed",
            "packed",
            "dispatched",
            "delivered",
            "paid",
          ];
          if (billedStatuses.includes(order.status)) {
            willBillOrder = false;
          } else {
            const billedCount = await manager.count(Ledger, {
              where: {
                business_id: dto.businessId,
                customer_id: dto.customerId,
                description: Like(`%Order ${order.order_number}%`),
              },
            });
            willBillOrder = billedCount === 0;
          }
        }

        if (willBillOrder) {
          await manager.increment(
            Customer,
            { id: dto.customerId },
            "outstanding_amount",
            Number(order!.total_amount),
          );
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: dto.businessId,
              customer_id: dto.customerId,
              type: "DEBIT",
              amount: order!.total_amount,
              description: `Order ${order!.order_number} billed`,
            }),
          );
        }

        if (dto.paymentMethod !== "Credit") {
          // Computed from the balance as loaded, before the increments above
          // touch the DB row, so a payment can never push the customer into
          // a negative (business-owes-them) balance.
          const projectedOutstanding =
            Number(customer.outstanding_amount) +
            (willBillOrder ? Number(order!.total_amount) : 0);
          // Only check overall customer ledger balance for non-order account payments.
          // Order-specific payments are already capped to the order's remaining balance.
          if (!order && paymentAmount > projectedOutstanding + 0.01) {
            throw new BadRequestException(
              "Payment amount exceeds the outstanding balance",
            );
          }

          await manager.increment(
            Customer,
            { id: dto.customerId },
            "outstanding_amount",
            -paymentAmount,
          );

          const ledger = manager.create(Ledger, {
            business_id: dto.businessId,
            customer_id: dto.customerId,
            type: "CREDIT",
            amount: paymentAmount,
            description: `Payment received (${dto.paymentMethod})${dto.orderId ? ` - order ${dto.orderId}` : ""}`,
          });
          await manager.save(ledger);
        }
      }

      const payment = manager.create(Payment, {
        business_id: dto.businessId,
        order_id: dto.orderId,
        amount: paymentAmount,
        payment_method: dto.paymentMethod,
        status: "completed",
        transaction_id: dto.transactionId,
      });
      const savedPayment = await manager.save(payment);

      if (order) {
        const paid = await manager
          .createQueryBuilder(Payment, "payment")
          .where("payment.order_id = :orderId", { orderId: dto.orderId })
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
      }

      return savedPayment;
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

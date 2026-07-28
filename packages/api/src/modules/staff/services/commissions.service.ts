import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Commission, CommissionStatus } from '../../../database/entities/commission.entity';
import { User } from '../../../database/entities/user.entity';
import { Order } from '../../../database/entities/order.entity';
import { PayoutCommissionDto } from '../dto/payout-commission.dto';

@Injectable()
export class CommissionsService {
  constructor(
    @InjectRepository(Commission) private commissionsRepository: Repository<Commission>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
  ) {}

  async createForOrder(businessId: string, orderId: string, userId: string, commissionRate: number, saleAmount: number) {
    if (commissionRate <= 0 || saleAmount <= 0) return null;

    const commissionEarned = Number(((saleAmount * commissionRate) / 100).toFixed(2));
    const commission = this.commissionsRepository.create({
      business_id: businessId,
      user_id: userId,
      order_id: orderId,
      sale_amount: saleAmount,
      commission_rate: commissionRate,
      commission_earned: commissionEarned,
      status: CommissionStatus.PENDING,
    });

    return this.commissionsRepository.save(commission);
  }

  async getCommissions(businessId: string, userId?: string, status?: CommissionStatus) {
    const query = this.commissionsRepository
      .createQueryBuilder('comm')
      .innerJoinAndSelect('comm.user', 'user')
      .leftJoinAndSelect('comm.order', 'order')
      .where('comm.business_id = :businessId', { businessId });

    if (userId) {
      query.andWhere('comm.user_id = :userId', { userId });
    }

    if (status) {
      query.andWhere('comm.status = :status', { status });
    }

    query.orderBy('comm.created_at', 'DESC');
    return query.getMany();
  }

  async getSummary(businessId: string) {
    const raw = await this.commissionsRepository
      .createQueryBuilder('comm')
      .select('comm.user_id', 'userId')
      .addSelect('SUM(comm.sale_amount)', 'totalSales')
      .addSelect('SUM(comm.commission_earned)', 'totalCommission')
      .addSelect("SUM(CASE WHEN comm.status = 'PAID' THEN comm.commission_earned ELSE 0 END)", 'paidCommission')
      .addSelect("SUM(CASE WHEN comm.status = 'PENDING' THEN comm.commission_earned ELSE 0 END)", 'pendingCommission')
      .where('comm.business_id = :businessId', { businessId })
      .groupBy('comm.user_id')
      .getRawMany();

    const users = await this.usersRepository.find({ where: { business_id: businessId } });
    const userMap = new Map(users.map((u) => [u.id, u.full_name || u.email]));

    return raw.map((r) => ({
      userId: r.userId,
      userName: userMap.get(r.userId) || 'Staff Member',
      totalSales: Number(r.totalSales || 0),
      totalCommission: Number(r.totalCommission || 0),
      paidCommission: Number(r.paidCommission || 0),
      pendingCommission: Number(r.pendingCommission || 0),
    }));
  }

  async payout(dto: PayoutCommissionDto) {
    const records = await this.commissionsRepository.find({
      where: {
        business_id: dto.businessId,
        id: In(dto.commissionIds),
      },
    });

    if (records.length === 0) {
      throw new NotFoundException('No commission records found to pay out');
    }

    const now = new Date();
    for (const record of records) {
      record.status = CommissionStatus.PAID;
      record.paid_at = now;
    }

    await this.commissionsRepository.save(records);
    return { count: records.length, paidAt: now };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../../database/entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private expensesRepository: Repository<Expense>,
  ) {}

  create(dto: CreateExpenseDto) {
    const expense = this.expensesRepository.create({
      business_id: dto.businessId,
      category: dto.category,
      amount: dto.amount,
      description: dto.description,
      expense_date: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
    });
    return this.expensesRepository.save(expense);
  }

  findAll(businessId: string, from?: string, to?: string) {
    const query = this.expensesRepository
      .createQueryBuilder('expense')
      .where('expense.business_id = :businessId', { businessId });

    if (from) {
      query.andWhere('expense.expense_date >= :from', { from });
    }
    if (to) {
      query.andWhere('expense.expense_date <= :to', { to });
    }

    return query.orderBy('expense.expense_date', 'DESC').addOrderBy('expense.created_at', 'DESC').getMany();
  }

  async remove(id: string, businessId: string) {
    const expense = await this.expensesRepository.findOne({ where: { id, business_id: businessId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    await this.expensesRepository.remove(expense);
    return { deleted: true };
  }
}

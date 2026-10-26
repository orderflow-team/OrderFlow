import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto) {
    return this.expensesService.create(dto);
  }

  @Get()
  findAll(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expensesService.findAll(businessId, from, to);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.expensesService.remove(id, businessId);
  }
}

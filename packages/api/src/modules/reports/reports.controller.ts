import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // Unrestricted: this is also the data source for the home Dashboard page,
  // which every role (including Cashier/Waiter/Salesman/etc.) lands on.
  @Get('dashboard')
  dashboard(@Query('businessId') businessId: string) {
    return this.reportsService.dashboard(businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('sales')
  salesReport(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.salesReport(businessId, from, to);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('outstanding')
  outstandingReport(@Query('businessId') businessId: string) {
    return this.reportsService.outstandingReport(businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('profit')
  profitReport(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.profitReport(businessId, from, to);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('tax')
  taxReport(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.taxReport(businessId, from, to);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('analytics')
  analyticsDashboard(@Query('businessId') businessId: string, @Query('days') days?: string) {
    return this.reportsService.analyticsDashboard(businessId, days ? Number(days) : 30);
  }
}

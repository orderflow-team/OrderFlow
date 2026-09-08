import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
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
  dashboard(
    @Req() req: Request & { user?: { businessId?: string } },
    @Query('businessId') businessId?: string,
  ) {
    const effectiveBizId = businessId || req.user?.businessId || '';
    return this.reportsService.dashboard(effectiveBizId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('sales')
  salesReport(
    @Req() req: Request & { user?: { businessId?: string } },
    @Query('businessId') businessId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const effectiveBizId = businessId || req.user?.businessId || '';
    return this.reportsService.salesReport(effectiveBizId, from, to);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('outstanding')
  outstandingReport(
    @Req() req: Request & { user?: { businessId?: string } },
    @Query('businessId') businessId?: string,
  ) {
    const effectiveBizId = businessId || req.user?.businessId || '';
    return this.reportsService.outstandingReport(effectiveBizId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('profit')
  profitReport(
    @Req() req: Request & { user?: { businessId?: string } },
    @Query('businessId') businessId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const effectiveBizId = businessId || req.user?.businessId || '';
    return this.reportsService.profitReport(effectiveBizId, from, to);
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
  @Get('gst-summary')
  gstSummaryReport(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.gstSummaryReport(businessId, from, to);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('schedule-h1-register')
  scheduleH1Register(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.scheduleH1Register(businessId, from, to);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Get('analytics')
  analyticsDashboard(@Query('businessId') businessId: string, @Query('days') days?: string) {
    return this.reportsService.analyticsDashboard(businessId, days ? Number(days) : 30);
  }
}

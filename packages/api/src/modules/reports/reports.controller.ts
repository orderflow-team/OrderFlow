import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  dashboard(@Query('businessId') businessId: string) {
    return this.reportsService.dashboard(businessId);
  }

  @Get('sales')
  salesReport(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.salesReport(businessId, from, to);
  }

  @Get('outstanding')
  outstandingReport(@Query('businessId') businessId: string) {
    return this.reportsService.outstandingReport(businessId);
  }

  @Get('profit')
  profitReport(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.profitReport(businessId, from, to);
  }

  @Get('tax')
  taxReport(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.taxReport(businessId, from, to);
  }

  @Get('analytics')
  analyticsDashboard(@Query('businessId') businessId: string, @Query('days') days?: string) {
    return this.reportsService.analyticsDashboard(businessId, days ? Number(days) : 30);
  }
}

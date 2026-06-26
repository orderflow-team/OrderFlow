import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SalesmanService } from './salesman.service';
import { CreateSalesmanDto } from './dto/create-salesman.dto';
import { CheckinVisitDto } from './dto/checkin-visit.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/salesman')
export class SalesmanController {
  constructor(private salesmanService: SalesmanService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(@Body() dto: CreateSalesmanDto) {
    return this.salesmanService.create(dto);
  }

  @Get()
  findAll(@Query('businessId') businessId: string) {
    return this.salesmanService.findAll(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.salesmanService.findOne(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALESMAN)
  @Post('visits/check-in')
  checkIn(@Body() dto: CheckinVisitDto) {
    return this.salesmanService.checkIn(dto);
  }

  @Post('visits/:id/check-out')
  checkOut(@Param('id') id: string) {
    return this.salesmanService.checkOut(id);
  }

  @Get(':id/visits')
  findVisitsBySalesman(@Param('id') id: string) {
    return this.salesmanService.findVisitsBySalesman(id);
  }

  @Get('visits/by-customer/:customerId')
  findVisitsByCustomer(@Param('customerId') customerId: string) {
    return this.salesmanService.findVisitsByCustomer(customerId);
  }
}

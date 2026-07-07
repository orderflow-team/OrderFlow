import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SalesmanService } from './salesman.service';
import { CreateSalesmanDto } from './dto/create-salesman.dto';
import { CheckinVisitDto } from './dto/checkin-visit.dto';
import { CreateSalesmanLoginDto } from './dto/create-salesman-login.dto';
import { UpdateSalesmanLoginDto } from './dto/update-salesman-login.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':id/create-login')
  createLogin(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: CreateSalesmanLoginDto,
  ) {
    return this.salesmanService.createLogin(id, businessId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get(':id/login')
  getLogin(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.salesmanService.getLoginCredentials(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id/login')
  updateLogin(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateSalesmanLoginDto,
  ) {
    return this.salesmanService.updateLogin(id, businessId, dto);
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

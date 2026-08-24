import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  // limit/offset/search are optional and unbounded/unfiltered when omitted
  // — see findAllPaginated's comment in customers.service.ts for why this
  // forks into a separate method rather than changing findAll's own
  // contract (chat-order's balance lookup calls CustomersService.findAll
  // directly and needs the full, unbounded list).
  @Get()
  async findAll(
    @Query('businessId') businessId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (limit === undefined && offset === undefined && search === undefined) {
      return this.customersService.findAll(businessId);
    }
    const { customers, total } = await this.customersService.findAllPaginated(
      businessId,
      search,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
    res?.setHeader('X-Total-Count', String(total));
    return customers;
  }

  // Must be registered before the `:id` route below, or "stats" would be
  // swallowed as an :id param instead of matching here.
  @Get('stats')
  getStats(@Query('businessId') businessId: string) {
    return this.customersService.getStats(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.customersService.findOne(id, businessId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, businessId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.customersService.remove(id, businessId);
  }
}

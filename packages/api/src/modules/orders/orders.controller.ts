import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderItemDto, AddOrderItemsDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    try {
      return await this.ordersService.create(dto);
    } catch (error: any) {
      require('fs').appendFileSync('error.log', error.stack + '\n\n');
      throw error;
    }
  }

  @Get()
  findAll(@Query('businessId') businessId: string, @Query('status') status?: string) {
    return this.ordersService.findAll(businessId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.ordersService.findOne(id, businessId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, businessId, dto);
  }

  @Post(':id/items')
  addItems(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.ordersService.addItems(id, businessId, dto);
  }

  @Put(':id/items')
  replaceItems(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.ordersService.replaceItems(id, businessId, dto);
  }

  @Post('suggest-price')
  suggestPrice(
    @Query('businessId') businessId: string,
    @Query('customerId') customerId: string,
    @Body() item: CreateOrderItemDto,
  ) {
    return this.ordersService.suggestPrice(businessId, customerId, item);
  }
}

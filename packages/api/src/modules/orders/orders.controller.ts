import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderItemDto, AddOrderItemsDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() req: Request & { user?: { userId: string } }) {
    try {
      return await this.ordersService.create(dto, req.user?.userId);
    } catch (error: any) {
      require('fs').appendFileSync('error.log', error.stack + '\n\n');
      throw error;
    }
  }

  @Get()
  findAll(
    @Query('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.ordersService.findAll(businessId, status, customerId);
  }

  // Static routes MUST come before @Get(':id') or NestJS will match them as the id param
  @Get('customer-prices')
  customerPrices(
    @Query('businessId') businessId: string,
    @Query('customerId') customerId: string,
  ) {
    return this.ordersService.customerPrices(businessId, customerId);
  }

  @Post('suggest-price')
  suggestPrice(
    @Query('businessId') businessId: string,
    @Query('customerId') customerId: string,
    @Body() item: CreateOrderItemDto,
  ) {
    return this.ordersService.suggestPrice(businessId, customerId, item);
  }

  @Get(':id/receipt')
  async getReceipt(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Res() res: Response,
  ) {
    const html = await this.ordersService.getOrderReceiptHtml(id, businessId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
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

  @Post(':id/return')
  returnOrder(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    return this.ordersService.returnOrder(id, businessId);
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

  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.ordersService.remove(id, businessId);
  }
}

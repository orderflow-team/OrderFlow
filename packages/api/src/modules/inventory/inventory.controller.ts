import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { InventoryService } from './inventory.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('purchase-orders')
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.inventoryService.createPurchaseOrder(dto);
  }

  @Get('purchase-orders')
  findAllPurchaseOrders(@Query('businessId') businessId: string, @Query('status') status?: string) {
    return this.inventoryService.findAllPurchaseOrders(businessId, status);
  }

  @Get('purchase-orders/:id')
  findOnePurchaseOrder(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.inventoryService.findOnePurchaseOrder(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('purchase-orders/:id/receive')
  receivePurchaseOrder(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.inventoryService.receivePurchaseOrder(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('adjust')
  adjustStock(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(dto);
  }

  @Get('stock-history')
  findStockHistory(@Query('businessId') businessId: string, @Query('productId') productId?: string) {
    return this.inventoryService.findStockHistory(businessId, productId);
  }

  @Get('low-stock')
  lowStock(@Query('businessId') businessId: string, @Query('threshold') threshold?: string) {
    return this.inventoryService.lowStock(businessId, threshold ? Number(threshold) : undefined);
  }
}

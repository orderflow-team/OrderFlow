import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { InventoryService } from './inventory.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
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
  @Patch('purchase-orders/:id')
  updatePurchaseOrder(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.inventoryService.updatePurchaseOrder(id, businessId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('purchase-orders/:id/receive')
  receivePurchaseOrder(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.inventoryService.receivePurchaseOrder(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('purchase-orders/:id/confirm')
  confirmPurchaseOrder(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.inventoryService.confirmPurchaseOrder(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('purchase-orders/:id/mark-paid')
  markPurchaseOrderPaid(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.inventoryService.markPurchaseOrderPaid(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('purchase-orders/:id/cancel')
  cancelPurchaseOrder(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.inventoryService.cancelPurchaseOrder(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('adjust')
  adjustStock(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(dto);
  }

  @Get('products/:productId/batches')
  findProductBatches(@Param('productId') productId: string, @Query('businessId') businessId: string) {
    return this.inventoryService.findProductBatches(productId, businessId);
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

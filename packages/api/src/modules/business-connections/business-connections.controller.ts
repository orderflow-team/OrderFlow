import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { BusinessConnectionsService } from './business-connections.service';
import { RequestConnectionDto } from './dto/request-connection.dto';
import { ConnectionBusinessScopeDto } from './dto/connection-business-scope.dto';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/business-connections')
export class BusinessConnectionsController {
  constructor(private connectionsService: BusinessConnectionsService) {}

  @Post('request')
  request(@Body() dto: RequestConnectionDto) {
    return this.connectionsService.request(dto);
  }

  @Get()
  list(@Query('businessId') businessId: string) {
    return this.connectionsService.listForBusiness(businessId);
  }

  @Get('check-phone')
  checkPhone(@Query('businessId') businessId: string, @Query('phone') phone: string) {
    return this.connectionsService.checkPhone(businessId, phone);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @Body() dto: ConnectionBusinessScopeDto) {
    return this.connectionsService.accept(id, dto.businessId);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ConnectionBusinessScopeDto) {
    return this.connectionsService.reject(id, dto.businessId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.connectionsService.remove(id, businessId);
  }
}

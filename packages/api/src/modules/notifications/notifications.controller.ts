import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@Query('businessId') businessId: string, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.findAll(businessId, unreadOnly === 'true');
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.notificationsService.markRead(id, businessId);
  }
}

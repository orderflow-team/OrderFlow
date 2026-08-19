import { Body, Controller, Delete, Get, Patch, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  @Post('device-token')
  registerDeviceToken(
    @Req() req: any,
    @Body() body: { businessId: string; token: string; platform?: string },
  ) {
    return this.notificationsService.registerDeviceToken(body.businessId, req.user.userId, body.token, body.platform || 'android');
  }

  // Body rather than a :token path param — FCM tokens routinely contain
  // characters (+, /, :) that are awkward to URL-encode reliably client-side.
  // businessId is required (unlike the other routes here) purely so
  // BusinessScopeGuard has something to check — without it, any
  // authenticated user on any business could unregister an arbitrary token.
  @Delete('device-token')
  unregisterDeviceToken(@Body() body: { businessId: string; token: string }) {
    return this.notificationsService.unregisterDeviceToken(body.businessId, body.token);
  }

  @Post('test-push')
  sendTestPush(@Body() body: { businessId: string }) {
    return this.notificationsService.sendTestPush(body.businessId);
  }
}

import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { WhatsappService } from './whatsapp.service';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/whatsapp')
export class WhatsappController {
  constructor(private whatsappService: WhatsappService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('settings')
  getSettings(@Req() req: any) {
    return this.whatsappService.getSettings(req.user.businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('connect')
  connect(@Req() req: any, @Body() dto: { phoneNumber?: string }) {
    return this.whatsappService.connect(req.user.businessId, dto.phoneNumber);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('disconnect')
  disconnect(@Req() req: any) {
    return this.whatsappService.disconnect(req.user.businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('toggle')
  toggle(@Req() req: any, @Body() dto: { enabled: boolean }) {
    return this.whatsappService.toggleEnabled(req.user.businessId, dto.enabled);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { PlatformAdminService } from './platform-admin.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN) // SUPER_ADMIN & platform developer ADMIN
@Controller('api/platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('overview')
  getOverview() {
    return this.platformAdminService.getOverviewStats();
  }

  @Get('users')
  getAllUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('business_id') business_id?: string,
    @Query('is_active') is_active?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getAllUsers({
      search,
      role,
      business_id,
      is_active,
      page,
      limit,
    });
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') userId: string,
    @Body()
    dto: {
      full_name?: string;
      email?: string;
      role?: UserRole;
      business_id?: string;
      is_active?: boolean;
      password?: string;
    },
    @Req() req: any,
  ) {
    return this.platformAdminService.updateUser(userId, dto, req.user?.userId);
  }

  @Patch('users/:id/status')
  toggleUserStatus(
    @Param('id') userId: string,
    @Body('is_active') is_active: boolean,
    @Req() req: any,
  ) {
    return this.platformAdminService.toggleUserStatus(userId, is_active, req.user?.userId);
  }

  @Get('stores')
  getAllStores(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getAllStores({ search, category, page, limit });
  }

  @Patch('stores/:id')
  updateStore(
    @Param('id') storeId: string,
    @Body()
    dto: {
      name?: string;
      category?: string;
      inventory_enabled?: boolean;
      ai_chat_enabled?: boolean;
      gst_number?: string;
    },
    @Req() req: any,
  ) {
    return this.platformAdminService.updateStore(storeId, dto, req.user?.userId);
  }

  @Get('activity-logs')
  getActivityLogs(
    @Query('action') action?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getActivityLogs({ action, search, page, limit });
  }

  @Get('products-overview')
  getProductsOverview(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('business_id') business_id?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getProductsOverview({ search, category, business_id, page, limit });
  }

  @Get('orders')
  getGlobalOrders(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('business_id') business_id?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getGlobalOrders({ search, status, business_id, page, limit });
  }

  @Get('health')
  getSystemHealth() {
    return this.platformAdminService.getSystemHealth();
  }

  @Get('announcement')
  getAnnouncement() {
    return this.platformAdminService.getAnnouncement();
  }

  @Post('announcement')
  setAnnouncement(@Body() dto: { active: boolean; message: string; type?: string }) {
    return this.platformAdminService.setAnnouncement(dto);
  }

  @Post('impersonate/:businessId')
  impersonateStore(@Param('businessId') businessId: string) {
    return this.platformAdminService.impersonateStore(businessId);
  }

  @Get('snapshot')
  exportSystemSnapshot() {
    return this.platformAdminService.exportSystemSnapshot();
  }
}

@Controller('api/platform-admin-bootstrap')
export class PlatformAdminBootstrapController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Post()
  bootstrap() {
    return this.platformAdminService.bootstrapSuperAdmin();
  }
}

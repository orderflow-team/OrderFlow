import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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

// SUPER_ADMIN only. UserRole.ADMIN is NOT a platform-admin role — it's the
// role every self-signup business owner gets (see AuthService.signup), and
// this controller has no BusinessScopeGuard on top, so allowing ADMIN here
// used to mean any shop owner on the platform could call every one of these
// endpoints: list every user/business across every tenant, read global
// orders, delete/update any store, change any user's role (including
// self-promoting to SUPER_ADMIN), export a full system snapshot, and
// impersonate any business. Not a narrow edge case — every signed-up owner
// already had this, just hidden by the frontend's nav/route gating.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
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

  @Get('users/:id/stores')
  getStoresForUser(@Param('id') userId: string) {
    return this.platformAdminService.getStoresForUser(userId);
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
    @Query('subscription_status') subscription_status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getAllStores({ search, category, subscription_status, page, limit });
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
      b2b_sync_enabled?: boolean;
      gst_number?: string;
    },
    @Req() req: any,
  ) {
    return this.platformAdminService.updateStore(storeId, dto, req.user?.userId);
  }

  @Patch('stores/:id/subscription')
  updateStoreSubscription(
    @Param('id') storeId: string,
    @Body()
    dto: {
      plan_code?: string;
      status?: 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled';
      extend_days?: number;
      billing_cycle?: 'monthly' | 'yearly';
    },
    @Req() req: any,
  ) {
    return this.platformAdminService.updateStoreSubscription(storeId, dto, req.user?.userId);
  }

  @Post('stores/:id/test-push')
  sendTestPush(@Param('id') storeId: string, @Req() req: any) {
    return this.platformAdminService.sendTestPush(storeId, req.user?.userId);
  }

  // businessId omitted/null broadcasts to every store — not nested under
  // stores/:id since "no specific store" is a valid, deliberate target here.
  @Post('broadcast-push')
  sendCustomPush(@Body() body: { businessId?: string; title: string; message: string }, @Req() req: any) {
    return this.platformAdminService.sendCustomPush(body.businessId || null, body.title, body.message, req.user?.userId);
  }

  @Delete('stores/:id')
  deleteStore(@Param('id') storeId: string, @Req() req: any) {
    return this.platformAdminService.deleteStore(storeId, req.user?.userId);
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
    @Query('origin') origin?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getGlobalOrders({ search, status, business_id, origin, page, limit });
  }

  @Get('business-connections')
  getBusinessConnections(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformAdminService.getBusinessConnections({ search, status, page, limit });
  }

  @Get('health')
  getSystemHealth() {
    return this.platformAdminService.getSystemHealth();
  }

  @Get('live-users')
  getLiveUsers() {
    return this.platformAdminService.getLiveUsers();
  }

  // Overrides the class-level @Roles(SUPER_ADMIN) with an empty list, which
  // RolesGuard treats as "any authenticated user" — this specific read is a
  // platform-wide broadcast banner every regular business user's app-shell
  // polls on load (apps/web/components/app-shell.tsx), not an admin-only
  // read. It got swept into the SUPER_ADMIN-only lockdown along with the
  // rest of this controller and was silently 403ing for every non-admin
  // user (app-shell's fetch has a bare .catch(() => {}), so the banner just
  // never appeared — no visible error). Posting a new announcement stays
  // SUPER_ADMIN-only via the class default.
  @Roles()
  @Get('announcement')
  getAnnouncement() {
    return this.platformAdminService.getAnnouncement();
  }

  @Post('announcement')
  setAnnouncement(@Body() dto: { active: boolean; message: string; type?: string }) {
    return this.platformAdminService.setAnnouncement(dto);
  }

  // Same open-read override as announcement, above — every user's login
  // page and app-shell need to know if maintenance is active, not just
  // super_admins.
  @Roles()
  @Get('maintenance')
  getMaintenanceStatus() {
    return this.platformAdminService.getMaintenanceStatus();
  }

  @Post('maintenance')
  setMaintenanceMode(@Body() dto: { active: boolean; message?: string }) {
    return this.platformAdminService.setMaintenanceMode(dto);
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

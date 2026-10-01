import { Controller, Get, Post, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SubscriptionsService } from './subscriptions.service';

@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getPublicPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrentSubscription(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const businessId = req.user?.business_id;
    return this.subscriptionsService.getUserSubscriptionStatus(userId, businessId);
  }

  // Activates a plan with no payment — super admin only (testing). Shops use
  // upgrade-request below, which a super admin approves after payment.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('simulate-upgrade')
  async simulateUpgrade(
    @Req() req: any,
    @Body() body: { planCode: string; billingCycle?: 'monthly' | 'yearly' }
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!body.planCode) {
      throw new BadRequestException('planCode is required');
    }
    return this.subscriptionsService.simulateLocalPaymentUpgrade(
      userId,
      body.planCode,
      body.billingCycle || 'monthly'
    );
  }

  /** The shop owner asks to move to a paid plan; nothing activates until a super admin approves it. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('upgrade-request')
  async requestUpgrade(
    @Req() req: any,
    @Body() body: { planCode: string; billingCycle?: 'monthly' | 'yearly' },
  ) {
    if (!body?.planCode) {
      throw new BadRequestException('planCode is required');
    }
    const cycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const businessId = await this.resolveBusinessId(req);
    return this.subscriptionsService.requestUpgrade(businessId, req.user?.userId, body.planCode, cycle);
  }

  @UseGuards(JwtAuthGuard)
  @Get('upgrade-request')
  async getUpgradeRequest(@Req() req: any) {
    const businessId = await this.resolveBusinessId(req);
    return { request: await this.subscriptionsService.getPendingUpgradeRequest(businessId) };
  }

  /** Super-admin queue of shops waiting for a plan to be activated. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get('upgrade-requests')
  listUpgradeRequests() {
    return this.subscriptionsService.listPendingUpgradeRequests();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('upgrade-requests/:id/approve')
  approveUpgradeRequest(@Param('id') id: string, @Req() req: any) {
    return this.subscriptionsService.approveUpgradeRequest(id, req.user?.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('upgrade-requests/:id/reject')
  rejectUpgradeRequest(@Param('id') id: string, @Req() req: any) {
    return this.subscriptionsService.rejectUpgradeRequest(id, req.user?.userId);
  }

  private async resolveBusinessId(req: any): Promise<string> {
    let businessId = req.user?.businessId || req.user?.business_id;
    const userId = req.user?.userId || req.user?.id;
    if (!businessId && userId) {
      businessId = await this.subscriptionsService.resolveUserBusinessId(userId);
    }
    if (!businessId) {
      throw new BadRequestException('Please set up or select a store workspace first.');
    }
    return businessId;
  }

  @UseGuards(JwtAuthGuard)
  @Get('referral-info')
  async getReferralInfo(@Req() req: any) {
    let businessId = req.user?.businessId || req.user?.business_id;
    const userId = req.user?.userId || req.user?.id;
    if (!businessId && userId) {
      businessId = await this.subscriptionsService.resolveUserBusinessId(userId);
    }
    return this.subscriptionsService.getReferralInfo(businessId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('apply-referral')
  async applyReferral(@Req() req: any, @Body() body: { referralCode: string }) {
    let businessId = req.user?.businessId || req.user?.business_id;
    const userId = req.user?.userId || req.user?.id;
    if (!businessId && userId) {
      businessId = await this.subscriptionsService.resolveUserBusinessId(userId);
    }
    if (!businessId) {
      throw new BadRequestException('Please set up or select a store workspace before applying a referral code.');
    }
    if (!body.referralCode) {
      throw new BadRequestException('referralCode is required');
    }
    return this.subscriptionsService.applyReferralCode(businessId, body.referralCode);
  }
}

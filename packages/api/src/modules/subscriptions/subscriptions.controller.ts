import { Controller, Get, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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

  @UseGuards(JwtAuthGuard)
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

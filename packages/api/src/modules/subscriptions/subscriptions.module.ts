import { Module, Global } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionPaywallGuard } from './subscription-paywall.guard';

@Global()
@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionPaywallGuard],
  exports: [SubscriptionsService, SubscriptionPaywallGuard],
})
export class SubscriptionsModule {}

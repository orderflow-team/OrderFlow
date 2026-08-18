import { Controller, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { DevToolsService } from './dev-tools.service';

// These endpoints delete real, unrecoverable business data (see clearAll's
// own comment) — restricted to the business owner/platform admin, not every
// authenticated staff login. Previously any role (cashier, waiter, ...) that
// happened to be logged in could wipe the whole business.
@UseGuards(JwtAuthGuard, BusinessScopeGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('api/dev')
export class DevToolsController {
  constructor(private devToolsService: DevToolsService) {}

  @Post('seed')
  seedAll(@Query('businessId') businessId: string) {
    return this.devToolsService.seedAll(businessId);
  }

  @Delete('clear/:module')
  clearModule(@Param('module') module: string, @Query('businessId') businessId: string) {
    return this.devToolsService.clearModule(module, businessId);
  }

  @Delete('clear-all')
  clearAll(@Query('businessId') businessId: string) {
    return this.devToolsService.clearAll(businessId);
  }
}

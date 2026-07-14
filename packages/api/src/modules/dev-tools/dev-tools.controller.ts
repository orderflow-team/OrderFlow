import { Controller, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { DevToolsService } from './dev-tools.service';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
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

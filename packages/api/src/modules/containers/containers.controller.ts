import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { ContainersService } from './containers.service';
import { RecordReturnDto } from './dto/record-return.dto';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/containers')
export class ContainersController {
  constructor(private containersService: ContainersService) {}

  @Post('returns')
  recordReturn(@Body() dto: RecordReturnDto) {
    return this.containersService.recordReturn(dto);
  }

  @Get('report')
  report(@Query('businessId') businessId: string) {
    return this.containersService.report(businessId);
  }

  @Get('customers/:customerId')
  pendingForCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('businessId') businessId: string,
  ) {
    return this.containersService.pendingForCustomer(businessId, customerId);
  }
}

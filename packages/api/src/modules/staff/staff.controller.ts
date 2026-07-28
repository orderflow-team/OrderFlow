import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { StaffService } from './staff.service';
import { AttendanceService } from './services/attendance.service';
import { CommissionsService } from './services/commissions.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';
import { PayoutCommissionDto } from './dto/payout-commission.dto';
import { CommissionStatus } from '../../database/entities/commission.entity';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('api/staff')
export class StaffController {
  constructor(
    private staffService: StaffService,
    private attendanceService: AttendanceService,
    private commissionsService: CommissionsService,
  ) {}

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto.businessId, dto);
  }

  @Get()
  findAll(@Query('businessId') businessId: string) {
    return this.staffService.findAll(businessId);
  }

  @Get(':id/credentials')
  getCredentials(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.staffService.getCredentials(id, businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Query('businessId') businessId: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, businessId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.staffService.remove(id, businessId);
  }

  // --- ATTENDANCE ENDPOINTS ---

  @Post('attendance/clock-in')
  clockIn(@Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(dto);
  }

  @Post('attendance/clock-out')
  clockOut(@Body() dto: ClockOutDto) {
    return this.attendanceService.clockOut(dto);
  }

  @Get('attendance/roster')
  getRoster(
    @Query('businessId') businessId: string,
    @Query('date') date?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendanceService.getRoster(businessId, date, userId);
  }

  @Post('attendance/manual')
  markManual(@Body() dto: ManualAttendanceDto) {
    return this.attendanceService.markManual(dto);
  }

  // --- COMMISSION ENDPOINTS ---

  @Get('commissions/list')
  getCommissions(
    @Query('businessId') businessId: string,
    @Query('userId') userId?: string,
    @Query('status') status?: CommissionStatus,
  ) {
    return this.commissionsService.getCommissions(businessId, userId, status);
  }

  @Get('commissions/summary')
  getCommissionsSummary(@Query('businessId') businessId: string) {
    return this.commissionsService.getSummary(businessId);
  }

  @Post('commissions/payout')
  payoutCommissions(@Body() dto: PayoutCommissionDto) {
    return this.commissionsService.payout(dto);
  }
}

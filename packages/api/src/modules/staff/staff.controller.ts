import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('api/staff')
export class StaffController {
  constructor(private staffService: StaffService) {}

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
}

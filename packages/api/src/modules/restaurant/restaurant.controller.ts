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
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AllowGuest } from '../../common/decorators/allow-guest.decorator';
import { getGuestScope } from '../../common/utils/guest-scope';
import { RestaurantService } from './restaurant.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { CreateKotDto } from './dto/create-kot.dto';
import { UpdateKotStatusDto } from './dto/update-kot-status.dto';
import { CreateKitchenStaffLoginDto } from './dto/create-kitchen-staff-login.dto';
import { UpdateKitchenStaffLoginDto } from './dto/update-kitchen-staff-login.dto';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/restaurant')
export class RestaurantController {
  constructor(private restaurantService: RestaurantService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER)
  @Post('tables')
  createTable(@Body() dto: CreateTableDto) {
    return this.restaurantService.createTable(dto);
  }

  // The table-QR guest page reads its own table's status from this list.
  @Get('tables')
  @AllowGuest()
  async findAllTables(
    @Query('businessId') businessId: string,
    @Query('status') status?: string,
    @Req() req?: { user?: { role?: string; userId?: string } },
  ) {
    const tables = await this.restaurantService.findAllTables(businessId, status);
    const guest = getGuestScope(req?.user);
    if (!guest) return tables;
    return guest.kind === 'table' ? tables.filter((t) => t.id === guest.tableId) : [];
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER)
  @Patch('tables/:id/status')
  updateTableStatus(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.restaurantService.updateTableStatus(id, businessId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER)
  @Post('tables/:id/release')
  releaseTable(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.restaurantService.releaseTable(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete('tables/:id')
  deleteTable(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.restaurantService.deleteTable(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER)
  @Post('kot')
  createKot(@Body() dto: CreateKotDto) {
    return this.restaurantService.createKot(dto);
  }

  @Get('kot')
  findAllKots(@Query('businessId') businessId: string, @Query('status') status?: string) {
    return this.restaurantService.findAllKots(businessId, status);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN_STAFF)
  @Patch('kot/:id/status')
  updateKotStatus(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateKotStatusDto,
  ) {
    return this.restaurantService.updateKotStatus(id, businessId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('kitchen-staff')
  createKitchenStaffLogin(@Query('businessId') businessId: string, @Body() dto: CreateKitchenStaffLoginDto) {
    return this.restaurantService.createKitchenStaffLogin(businessId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('kitchen-staff')
  listKitchenStaff(@Query('businessId') businessId: string) {
    return this.restaurantService.listKitchenStaff(businessId);
  }

  // Reveals the login's current plaintext password — owner only, like /api/staff
  // credentials. Managers can still edit the login (PATCH below) and reset the password.
  @Roles(UserRole.ADMIN)
  @Get('kitchen-staff/:id/login')
  getKitchenStaffLogin(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.restaurantService.getKitchenStaffCredentials(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch('kitchen-staff/:id')
  updateKitchenStaffLogin(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateKitchenStaffLoginDto,
  ) {
    return this.restaurantService.updateKitchenStaffLogin(id, businessId, dto);
  }
}

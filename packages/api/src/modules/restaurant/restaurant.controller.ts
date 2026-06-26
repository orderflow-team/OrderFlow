import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RestaurantService } from './restaurant.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { CreateKotDto } from './dto/create-kot.dto';
import { UpdateKotStatusDto } from './dto/update-kot-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/restaurant')
export class RestaurantController {
  constructor(private restaurantService: RestaurantService) {}

  @Post('tables')
  createTable(@Body() dto: CreateTableDto) {
    return this.restaurantService.createTable(dto);
  }

  @Get('tables')
  findAllTables(@Query('businessId') businessId: string, @Query('status') status?: string) {
    return this.restaurantService.findAllTables(businessId, status);
  }

  @Patch('tables/:id/status')
  updateTableStatus(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.restaurantService.updateTableStatus(id, businessId, dto);
  }

  @Post('tables/:id/release')
  releaseTable(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.restaurantService.releaseTable(id, businessId);
  }

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
}

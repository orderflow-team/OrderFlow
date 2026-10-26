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
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Get()
  findAll(@Query('businessId') businessId: string) {
    return this.suppliersService.findAll(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.suppliersService.findOne(id, businessId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, businessId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.suppliersService.remove(id, businessId);
  }
}

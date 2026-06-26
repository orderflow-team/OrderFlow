import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessesService } from './businesses.service';
import { AuthService } from '../auth/auth.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/businesses')
export class BusinessesController {
  constructor(
    private businessesService: BusinessesService,
    private authService: AuthService,
  ) {}

  /**
   * Onboarding: attaches a new business workspace to the authenticated user
   * and reissues tokens carrying the new businessId.
   */
  @Post('onboard')
  async onboard(@Req() req: any, @Body() dto: CreateBusinessDto) {
    const business = await this.businessesService.onboard(req.user.userId, dto);
    const tokens = await this.authService.reissueTokensForUser(req.user.userId);
    return { business, ...tokens };
  }

  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, dto);
  }
}

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

  /** Lists the businesses owned by the signed-in user, for the post-login workspace picker. */
  @Get('mine')
  findMine(@Req() req: any) {
    return this.businessesService.findMine(req.user.userId);
  }

  /** Switches the signed-in user's active workspace and reissues tokens carrying it. */
  @Post(':id/select')
  async select(@Req() req: any, @Param('id') id: string) {
    const business = await this.businessesService.selectActive(req.user.userId, id);
    const tokens = await this.authService.reissueTokensForUser(req.user.userId);
    return { business, ...tokens };
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto, req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.businessesService.findOne(id, req.user.userId, req.user.businessId);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, dto, req.user.userId);
  }
}

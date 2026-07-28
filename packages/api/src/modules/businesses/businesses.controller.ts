import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { BusinessesService } from './businesses.service';
import { AuthService } from '../auth/auth.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

const ALLOWED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, dto, req.user.userId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/logos';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        cb(null, ALLOWED_LOGO_MIME_TYPES.has(file.mimetype));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadLogo(@Req() req: any, @Param('id') id: string, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded, or file type/size not allowed (PNG, JPG, WEBP, GIF up to 5MB)');
    }
    return this.businessesService.updateLogo(id, `/uploads/logos/${file.filename}`, req.user.userId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete(':id/logo')
  removeLogo(@Req() req: any, @Param('id') id: string) {
    return this.businessesService.removeLogo(id, req.user.userId);
  }

  /** Permanently deletes the business and everything in it. Owner-only (checked in the service). */
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deleteAccount(@Req() req: any, @Param('id') id: string, @Body('confirmName') confirmName: string) {
    return this.businessesService.deleteAccount(id, req.user.userId, confirmName);
  }
}

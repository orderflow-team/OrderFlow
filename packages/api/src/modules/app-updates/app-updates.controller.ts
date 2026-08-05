import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AppUpdatesService } from './app-updates.service';

@Controller('api/app-updates')
export class AppUpdatesController {
  constructor(private readonly appUpdatesService: AppUpdatesService) {}

  /** Polled by the installed app on launch — deliberately unauthenticated so a device can check for an update before/without a signed-in session. */
  @Get('latest')
  getLatest(@Query('platform') platform = 'android') {
    return this.appUpdatesService.getLatest(platform);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get()
  list(@Query('platform') platform?: string) {
    return this.appUpdatesService.list(platform);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/app-releases';
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
    }),
  )
  create(
    @UploadedFile() file: any,
    @Body() body: { platform?: string; version?: string; minNativeVersion?: string; notes?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No bundle file uploaded');
    }
    return this.appUpdatesService.create(file, {
      platform: body.platform || 'android',
      version: body.version,
      minNativeVersion: body.minNativeVersion,
      notes: body.notes,
    });
  }

  /** Deactivate a bad release (rollback) or reactivate one — is_active alone decides what /latest returns. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  setActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.appUpdatesService.setActive(id, body.isActive);
  }
}

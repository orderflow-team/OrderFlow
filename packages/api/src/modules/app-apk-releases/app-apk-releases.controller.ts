import { Body, Controller, Get, Param, Patch, Post, Query, Redirect, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AppApkReleasesService } from './app-apk-releases.service';

@Controller('api/app-apk-releases')
export class AppApkReleasesController {
  constructor(private readonly appApkReleasesService: AppApkReleasesService) {}

  /** Polled by the installed app — deliberately unauthenticated so a device can check before/without a signed-in session. */
  @Get('latest')
  getLatest(@Query('platform') platform = 'android') {
    return this.appApkReleasesService.getLatest(platform);
  }

  /** What the public landing page's "Download APK" button links to — always resolves to whatever is currently the latest release, so that link never needs manual updating again. */
  @Get('download')
  @Redirect()
  async download(@Query('platform') platform = 'android') {
    const url = await this.appApkReleasesService.getDownloadUrl(platform);
    return { url, statusCode: 302 };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get()
  list(@Query('platform') platform?: string) {
    return this.appApkReleasesService.list(platform);
  }

  // SUPER_ADMIN only, not ADMIN: this is a platform-global, unauthenticated-read
  // release that every installed app polls and trusts — ADMIN is the role every
  // self-signup business owner gets, so allowing it here would let any tenant
  // push an APK to every device.
  //
  // No `storage` option -> multer's default memory storage, giving us `file.buffer`
  // to upload straight to Neon Object Storage instead of Render's ephemeral disk.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: any,
    @Body() body: { platform?: string; versionName?: string; notes?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No APK file uploaded');
    }
    return this.appApkReleasesService.create(file, {
      platform: body.platform || 'android',
      versionName: body.versionName,
      notes: body.notes,
    });
  }

  /** Deactivate a bad release (rollback) or reactivate one — is_active alone decides what /latest returns. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  setActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.appApkReleasesService.setActive(id, body.isActive);
  }
}

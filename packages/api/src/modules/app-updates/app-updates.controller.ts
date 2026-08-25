import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  // SUPER_ADMIN only, not ADMIN: this is a platform-global, unauthenticated-read
  // release that every installed app polls and trusts — ADMIN is the role every
  // self-signup business owner gets, so allowing it here would let any tenant
  // push an OTA bundle to every device.
  //
  // No `storage` option -> multer's default memory storage, giving us `file.buffer`
  // to upload straight to Neon Object Storage instead of Render's ephemeral disk.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
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
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  setActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.appUpdatesService.setActive(id, body.isActive);
  }
}

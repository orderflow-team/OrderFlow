import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { AppApkRelease } from '../../database/entities/app-apk-release.entity';
import { getPublicBaseUrl } from '../../common/utils/public-url.util';

@Injectable()
export class AppApkReleasesService {
  // Served before any release has ever been published through this system —
  // keeps the public landing-page download button from ever 404ing.
  private static readonly FALLBACK_APK_URL = 'https://obix-apk-download.vercel.app/obix.apk';

  constructor(@InjectRepository(AppApkRelease) private appApkReleasesRepository: Repository<AppApkRelease>) {}

  private findLatestActive(platform: string) {
    return this.appApkReleasesRepository.findOne({
      where: { platform, is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  /** The APK a device on `platform` should be running — polled by the in-app updater. */
  async getLatest(platform: string) {
    const release = await this.findLatestActive(platform);
    if (!release) {
      return null;
    }
    return {
      versionName: release.version_name,
      url: release.apk_url,
      checksum: release.checksum,
      notes: release.notes,
    };
  }

  /** Where the public "Download APK" button should send a brand-new install — always the latest published release. */
  async getDownloadUrl(platform: string): Promise<string> {
    const release = await this.findLatestActive(platform);
    return release?.apk_url || AppApkReleasesService.FALLBACK_APK_URL;
  }

  async list(platform?: string) {
    return this.appApkReleasesRepository.find({
      where: platform ? { platform } : {},
      order: { created_at: 'DESC' },
    });
  }

  async create(file: any, dto: { platform: string; versionName?: string; notes?: string }) {
    if (!file) {
      throw new BadRequestException('No APK file uploaded');
    }
    if (!dto.versionName) {
      throw new BadRequestException('versionName is required');
    }
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
    const release = this.appApkReleasesRepository.create({
      platform: dto.platform || 'android',
      version_name: dto.versionName,
      apk_url: `${getPublicBaseUrl()}/uploads/app-apk-releases/${file.filename}`,
      checksum,
      notes: dto.notes || null,
      is_active: true,
    });
    return this.appApkReleasesRepository.save(release);
  }

  /** Rolling back a bad release just deactivates it — the previous active release becomes "latest" again on the next poll. */
  async setActive(id: string, isActive: boolean) {
    const release = await this.appApkReleasesRepository.findOne({ where: { id } });
    if (!release) {
      throw new NotFoundException('Release not found');
    }
    release.is_active = isActive;
    return this.appApkReleasesRepository.save(release);
  }
}

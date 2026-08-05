import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { AppRelease } from '../../database/entities/app-release.entity';
import { getPublicBaseUrl } from '../../common/utils/public-url.util';

@Injectable()
export class AppUpdatesService {
  constructor(@InjectRepository(AppRelease) private appReleasesRepository: Repository<AppRelease>) {}

  /** The bundle a device on `platform` should be running — the single source of truth the OTA updater polls. */
  async getLatest(platform: string) {
    const release = await this.appReleasesRepository.findOne({
      where: { platform, is_active: true },
      order: { created_at: 'DESC' },
    });
    if (!release) {
      return null;
    }
    return {
      version: release.version,
      url: release.bundle_url,
      checksum: release.checksum,
      minNativeVersion: release.min_native_version,
      notes: release.notes,
    };
  }

  async list(platform?: string) {
    return this.appReleasesRepository.find({
      where: platform ? { platform } : {},
      order: { created_at: 'DESC' },
    });
  }

  async create(file: any, dto: { platform: string; version?: string; minNativeVersion?: string; notes?: string }) {
    if (!file) {
      throw new BadRequestException('No bundle file uploaded');
    }
    if (!dto.version) {
      throw new BadRequestException('version is required');
    }
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
    const release = this.appReleasesRepository.create({
      platform: dto.platform || 'android',
      version: dto.version,
      bundle_url: `${getPublicBaseUrl()}/uploads/app-releases/${file.filename}`,
      checksum,
      min_native_version: dto.minNativeVersion || null,
      notes: dto.notes || null,
      is_active: true,
    });
    return this.appReleasesRepository.save(release);
  }

  /** Rolling back a bad release just deactivates it — the previous active release becomes "latest" again on the next poll. */
  async setActive(id: string, isActive: boolean) {
    const release = await this.appReleasesRepository.findOne({ where: { id } });
    if (!release) {
      throw new NotFoundException('Release not found');
    }
    release.is_active = isActive;
    return this.appReleasesRepository.save(release);
  }
}

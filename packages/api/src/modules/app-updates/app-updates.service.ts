import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { extname } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AppRelease } from '../../database/entities/app-release.entity';
import { verifyOtaSignature } from '../../common/utils/ota-signature.util';

const OTA_BUNDLES_BUCKET = 'ota-bundles';

@Injectable()
export class AppUpdatesService {
  private readonly s3 = new S3Client({ forcePathStyle: true });

  constructor(@InjectRepository(AppRelease) private appReleasesRepository: Repository<AppRelease>) {}

  /**
   * The bundle a device on `platform` should be running — the single source
   * of truth the OTA updater polls. `platform` may be flavor-specific (e.g.
   * "android-playstore", "android-direct" — see use-native-app-update.ts /
   * ota-updater.ts for why the Android build has two distribution flavors)
   * or bare ("android", from clients built before flavors existed).
   *
   * A flavor-specific platform with no release published under that exact
   * key falls back to the bare OS platform, so most releases only ever need
   * publishing once (under "android") and reach every flavor automatically.
   * Publish under an exact flavor key (e.g. "android-playstore") only when
   * that flavor genuinely needs a different bundle than everyone else.
   */
  async getLatest(platform: string) {
    const release = await this.findActiveRelease(platform);
    if (release) return this.toLatestDto(release);

    const basePlatform = platform.split('-')[0];
    if (basePlatform !== platform) {
      const fallback = await this.findActiveRelease(basePlatform);
      if (fallback) return this.toLatestDto(fallback);
    }
    return null;
  }

  private findActiveRelease(platform: string) {
    return this.appReleasesRepository.findOne({
      where: { platform, is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  private toLatestDto(release: AppRelease) {
    return {
      // The platform the release was published under: part of what is signed, and the
      // app checks it is the channel it asked for (or that channel's base platform).
      platform: release.platform,
      version: release.version,
      url: release.bundle_url,
      checksum: release.checksum,
      signature: release.signature,
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

  async create(
    file: any,
    dto: { platform: string; version?: string; minNativeVersion?: string; notes?: string; signature?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No bundle file uploaded');
    }
    if (!dto.version) {
      throw new BadRequestException('version is required');
    }
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const platform = dto.platform || 'android';

    // With OTA_PUBLIC_KEY set (the public half of the offline signing key), a release must carry a
    // signature that verifies against it. The key is not secret; what matters is that the private
    // half never touches this server, so a stolen admin token or a compromised host cannot
    // publish code that installed apps will run. The apps re-check it themselves.
    const publicKey = process.env.OTA_PUBLIC_KEY;
    const signature = dto.signature?.trim() || null;
    if (publicKey) {
      if (!signature) {
        throw new BadRequestException('A signature is required: sign the release with the offline OTA key');
      }
      if (!verifyOtaSignature({ platform, version: dto.version, checksum, signature }, publicKey)) {
        throw new BadRequestException('The signature does not match this bundle, platform and version');
      }
    }
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: OTA_BUNDLES_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const release = this.appReleasesRepository.create({
      platform,
      version: dto.version,
      bundle_url: `${process.env.AWS_ENDPOINT_URL_S3}/${OTA_BUNDLES_BUCKET}/${key}`,
      checksum,
      signature,
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

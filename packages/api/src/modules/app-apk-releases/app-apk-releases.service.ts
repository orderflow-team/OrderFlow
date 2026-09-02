import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import * as fs from "fs";
import { extname } from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { AppApkRelease } from "../../database/entities/app-apk-release.entity";
import { uploadsFilePathFromUrl } from "../../common/utils/public-url.util";

const APK_RELEASES_BUCKET = "app-releases";

@Injectable()
export class AppApkReleasesService {
  // Served before any release has ever been published through this system —
  // keeps the public landing-page download button from ever 404ing.
  private static readonly FALLBACK_APK_URL =
    "https://obix-apk-download.vercel.app/obix.apk";

  // Public: Neon Object Storage bucket `app-releases` is public_read (see ../../../neon.ts),
  // so a plain endpoint/bucket/key URL is downloadable without presigning. Credentials,
  // endpoint, and region come from the AWS_* env vars Neon injects for this branch.
  private readonly s3 = new S3Client({ forcePathStyle: true });

  constructor(
    @InjectRepository(AppApkRelease)
    private appApkReleasesRepository: Repository<AppApkRelease>,
  ) {}

  private findLatestActive(platform: string) {
    return this.appApkReleasesRepository.findOne({
      where: { platform, is_active: true },
      order: { created_at: "DESC" },
    });
  }

  /**
   * Legacy releases (published before the move to Neon Object Storage) were saved to
   * Render's local disk, which is ephemeral — a redeploy silently wipes the file while
   * the DB row still points at it. Only check existence for those old /uploads URLs;
   * anything else (the Object Storage bucket, FALLBACK_APK_URL) persists and is trusted.
   */
  private releaseFileExists(apkUrl: string): boolean {
    if (!apkUrl.includes("/uploads/")) {
      return true;
    }
    try {
      return fs.existsSync(uploadsFilePathFromUrl(apkUrl));
    } catch {
      return false;
    }
  }

  /** The APK a device on `platform` should be running — polled by the in-app updater. */
  async getLatest(platform: string) {
    const release = await this.findLatestActive(platform);
    if (!release || !this.releaseFileExists(release.apk_url)) {
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
    if (release && this.releaseFileExists(release.apk_url)) {
      return release.apk_url;
    }
    return AppApkReleasesService.FALLBACK_APK_URL;
  }

  async list(platform?: string) {
    return this.appApkReleasesRepository.find({
      where: platform ? { platform } : {},
      order: { created_at: "DESC" },
    });
  }

  async create(
    file: any,
    dto: { platform: string; versionName?: string; notes?: string },
  ) {
    if (!file) {
      throw new BadRequestException("No APK file uploaded");
    }
    if (!dto.versionName) {
      throw new BadRequestException("versionName is required");
    }
    // APKs are ZIP archives. MIME types are supplied by the client and are
    // not a security boundary, so validate the extension and archive header
    // before putting a platform-wide download in public object storage.
    const isZipArchive =
      Buffer.isBuffer(file.buffer) &&
      file.buffer.length >= 4 &&
      file.buffer[0] === 0x50 &&
      file.buffer[1] === 0x4b &&
      (file.buffer[2] === 0x03 ||
        file.buffer[2] === 0x05 ||
        file.buffer[2] === 0x07) &&
      (file.buffer[3] === 0x04 ||
        file.buffer[3] === 0x06 ||
        file.buffer[3] === 0x08);
    if (extname(file.originalname).toLowerCase() !== ".apk" || !isZipArchive) {
      throw new BadRequestException("Only valid APK files can be uploaded");
    }
    const checksum = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: APK_RELEASES_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: 'attachment; filename="OBIX.apk"',
      }),
    );

    const release = this.appApkReleasesRepository.create({
      platform: dto.platform || "android",
      version_name: dto.versionName,
      apk_url: `${process.env.AWS_ENDPOINT_URL_S3}/${APK_RELEASES_BUCKET}/${key}`,
      checksum,
      notes: dto.notes || null,
      is_active: true,
    });
    return this.appApkReleasesRepository.save(release);
  }

  /** Rolling back a bad release just deactivates it — the previous active release becomes "latest" again on the next poll. */
  async setActive(id: string, isActive: boolean) {
    const release = await this.appApkReleasesRepository.findOne({
      where: { id },
    });
    if (!release) {
      throw new NotFoundException("Release not found");
    }
    release.is_active = isActive;
    return this.appApkReleasesRepository.save(release);
  }
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * A native Android APK release, separate from AppRelease (which tracks the
 * JS/web bundle shipped over OTA). Android itself enforces the APK's own
 * versionCode when installing over an existing app — this only needs
 * version_name for the in-app "is a newer build available" check.
 */
@Entity('app_apk_releases')
export class AppApkRelease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'android' })
  platform: string;

  @Column({ type: 'varchar', length: 20 })
  version_name: string;

  @Column({ type: 'text' })
  apk_url: string;

  @Column({ type: 'varchar', length: 64 })
  checksum: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}

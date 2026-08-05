import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('app_releases')
export class AppRelease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'android' })
  platform: string;

  // Web-bundle version the OTA updater tracks — independent of the native app's versionName/versionCode.
  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'text' })
  bundle_url: string;

  @Column({ type: 'varchar', length: 64 })
  checksum: string;

  // Guards against pushing a bundle that assumes a native capability an older installed APK doesn't have —
  // the update check skips this release for shells below this versionName until they reinstall the APK.
  @Column({ type: 'varchar', length: 20, nullable: true })
  min_native_version: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

// Singleton table (a single row, created lazily on first read/write) for
// platform-wide state that used to live as an in-memory field on
// PlatformAdminService — which reset to defaults on every server restart
// (Render redeploys often), silently dropping whatever announcement/
// maintenance state was set. See PlatformAdminService.getSettingsRow.
@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean', default: false })
  announcement_active: boolean;

  @Column({ type: 'text', nullable: true })
  announcement_message: string | null;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  announcement_type: string;

  // Blocks new logins (except super_admin, so the platform admin can always
  // get back in to turn it off) and shows maintenance_message as a banner to
  // already-logged-in users. See AuthService.login and app-shell.tsx.
  @Column({ type: 'boolean', default: false })
  maintenance_mode: boolean;

  @Column({ type: 'text', nullable: true })
  maintenance_message: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}

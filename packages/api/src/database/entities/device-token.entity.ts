import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from './business.entity';
import { User } from './user.entity';

/**
 * One row per app install that's registered for push (an FCM registration
 * token). Kept business-scoped rather than user-scoped for delivery — the
 * notifications this drives (order_reminder, payment_reminder, low_stock,
 * expiry_alert) are already business-wide with no per-user targeting, so a
 * push fans out to every device any staff member of that business is
 * signed in on, same as the in-app bell already shows to all of them.
 * user_id is kept only to let a user's own devices be cleaned up on logout.
 */
@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // The FCM registration token itself. Unique so re-registering the same
  // device (token refresh, reinstall) upserts in place instead of
  // accumulating duplicate rows that'd each get a separate push.
  @Column({ type: 'text', unique: true })
  token: string;

  @Column({ type: 'varchar', length: 20, default: 'android' })
  platform: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

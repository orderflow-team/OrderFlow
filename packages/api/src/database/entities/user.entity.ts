import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from './business.entity';
import { UserRole } from '../../common/enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash: string;

  // Reversible copy so an owner can view a staff login's current password.
  // Excluded from default selects — must be requested explicitly.
  @Column({ type: 'text', nullable: true, select: false })
  password_plain: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  full_name: string;

  @Column({ type: 'varchar', length: 50 })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // Touched (throttled, at most once/minute) by JwtStrategy on every
  // authenticated request — powers the admin "live users" view. Null means
  // never logged in / hasn't made an authenticated request since restart.
  @Column({ type: 'timestamptz', nullable: true })
  last_active_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

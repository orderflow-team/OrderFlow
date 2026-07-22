import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 6 })
  code: string;

  /** Scopes a code to what it's allowed to authorize, so a leaked login code can't also reset the password. */
  @Column({ type: 'varchar', length: 20, default: 'login' })
  purpose: 'login' | 'password_reset';

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'boolean', default: false })
  consumed: boolean;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @CreateDateColumn()
  created_at: Date;
}

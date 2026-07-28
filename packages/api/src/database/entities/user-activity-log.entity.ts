import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Business } from './business.entity';

@Entity('user_activity_logs')
export class UserActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'varchar', length: 100 })
  action: string; // e.g. 'USER_LOGIN', 'USER_UPDATED', 'STORE_STATUS_CHANGED', 'ORDER_CREATED'

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource: string; // e.g. 'User', 'Business', 'Order', 'Product'

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @CreateDateColumn()
  created_at: Date;
}

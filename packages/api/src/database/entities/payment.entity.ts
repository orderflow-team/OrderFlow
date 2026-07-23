import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Business } from './business.entity';
import { Order } from './order.entity';

@Entity('payments')
@Index(['business_id', 'client_request_id'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid', nullable: true })
  order_id: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method: string;

  @Column({ type: 'varchar', length: 50, default: 'completed' })
  status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transaction_id: string;

  // Client-generated UUID from the offline outbox — lets a retried sync of
  // the same queued payment be recognized instead of double-recording it.
  @Column({ type: 'varchar', length: 255, nullable: true })
  client_request_id: string;

  @CreateDateColumn()
  created_at: Date;
}

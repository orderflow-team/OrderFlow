import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from './business.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gst_number: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit_limit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  outstanding_amount: number;

  // Credit held for this customer from overpayments (single-order or bulk
  // "pay total") that exceeded what was actually owed — not yet applied to
  // any order.
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  advance_balance: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  custom_fields: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'due_on_receipt' })
  payment_terms: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  trade_discount_percentage: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

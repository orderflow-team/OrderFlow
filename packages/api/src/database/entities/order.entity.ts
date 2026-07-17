import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Business } from './business.entity';
import { Customer } from './customer.entity';
import { Table } from './table.entity';
import { OrderItem } from './order-item.entity';
import { User } from './user.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'varchar', length: 255 })
  customer_name: string;

  // Pharmacy-specific: printed on the Cash Memo PDF invoice when captured at
  // billing time. Optional — not every sale has a prescription behind it.
  @Column({ type: 'varchar', length: 255, nullable: true })
  patient_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  doctor_name: string;

  @Column({ type: 'uuid', nullable: true })
  table_id: string;

  @ManyToOne(() => Table)
  @JoinColumn({ name: 'table_id' })
  table: Table;

  @Column({ type: 'int', nullable: true })
  guest_count: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  order_number: string;

  @Column({ type: 'int', nullable: true })
  token_number: number;

  @Column({ type: 'varchar', length: 50, default: 'regular' })
  order_type: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Who placed this order — e.g. which salesman took it in the field.
  // Nullable: most orders are entered directly by the shop staff.
  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];
}

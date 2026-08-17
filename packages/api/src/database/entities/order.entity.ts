import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Business } from './business.entity';
import { Customer } from './customer.entity';
import { Table } from './table.entity';
import { OrderItem } from './order-item.entity';
import { User } from './user.entity';

@Entity('orders')
@Index(['business_id', 'client_request_id'], { unique: true })
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

  // Prescribing doctor's registration number — required record-keeping for a
  // Schedule H1/X drug sale (Drugs Rules 1945, Rule 65), captured here the
  // same optional way patient_name/doctor_name already are.
  @Column({ type: 'varchar', length: 100, nullable: true })
  doctor_registration_number: string;

  // Object key (not a URL — the `prescriptions` bucket is private) into
  // Neon Object Storage for a photo of the physical prescription, captured
  // optionally at checkout. Read access always goes through a presigned
  // URL (see OrdersController's prescription-url endpoint), never stored
  // or returned as a bare link.
  @Column({ type: 'varchar', length: 500, nullable: true })
  prescription_image_key: string | null;

  @Column({ type: 'uuid', nullable: true })
  table_id: string;

  @ManyToOne(() => Table)
  @JoinColumn({ name: 'table_id' })
  table: Table;

  @Column({ type: 'int', nullable: true })
  guest_count: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  order_number: string;

  // Client-generated UUID from the offline outbox (apps/web/lib/offline-db.ts)
  // — lets a retried sync of the same queued sale be recognized as the same
  // order instead of creating a duplicate. Null for orders created live.
  @Column({ type: 'varchar', length: 255, nullable: true })
  client_request_id: string;

  @Column({ type: 'int', nullable: true })
  token_number: number;

  @Column({ type: 'varchar', length: 50, default: 'regular' })
  order_type: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  // 'manual' (entered directly by shop staff) vs 'synced' (auto-created because
  // a linked retailer business raised a PurchaseOrder against a Customer here
  // that has linked_business_id set — see OrdersService.mirrorFromPurchaseOrder).
  @Column({ type: 'varchar', length: 20, default: 'manual' })
  origin: string;

  // The PurchaseOrder on the counterpart (retailer) business this Order was
  // mirrored from. Null for manually entered orders.
  @Column({ type: 'uuid', nullable: true })
  mirrored_purchase_order_id: string | null;

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

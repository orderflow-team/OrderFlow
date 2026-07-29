import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Business } from './business.entity';
import { Supplier } from './supplier.entity';
import { PurchaseItem } from './purchase-item.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid', nullable: true })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'varchar', length: 50, nullable: true })
  order_number: string;

  // Lifecycle: 'draft' -> 'confirmed' -> 'received' -> 'paid', with 'cancelled'
  // reachable only from 'draft'/'confirmed'. Mirrors Order's single linear
  // status string rather than a separate payment_status axis.
  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tax_amount: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => PurchaseItem, (item) => item.purchase_order)
  items: PurchaseItem[];
}

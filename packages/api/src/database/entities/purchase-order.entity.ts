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

  // 'manual' (entered directly by shop staff) vs 'synced' (auto-created because
  // a linked wholesaler business raised an Order against a Supplier here that
  // has linked_business_id set — see InventoryService.mirrorFromOrder).
  @Column({ type: 'varchar', length: 20, default: 'manual' })
  origin: string;

  // The Order on the counterpart (wholesaler) business this PurchaseOrder was
  // mirrored from. Null for manually entered purchase orders.
  @Column({ type: 'uuid', nullable: true })
  mirrored_order_id: string | null;

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

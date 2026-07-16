import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from './product.entity';

@Entity('purchase_items')
export class PurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  purchase_order_id: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @Column({ type: 'uuid', nullable: true })
  product_id: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: number;

  // Pharmacy-specific: the batch/expiry of the specific shipment being received,
  // applied to the product record when the purchase order is marked received.
  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_number: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date;

  // Free "scheme" quantity billed alongside the paid quantity (distributor
  // invoices often write this as e.g. "3+.15" — 3 billed, 0.15 scheme).
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  scheme_quantity: number;

  @CreateDateColumn()
  created_at: Date;
}

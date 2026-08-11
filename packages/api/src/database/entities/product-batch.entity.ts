import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Business } from './business.entity';
import { Product } from './product.entity';
import { Supplier } from './supplier.entity';
import { PurchaseOrder } from './purchase-order.entity';

// One row per physical batch received of a product — lets a product carry
// several concurrent batches (each with its own expiry/remaining qty)
// instead of the single overwritable batch_number/expiry_date on Product
// itself. Product.stock_quantity remains the aggregate total; these rows
// are additive bookkeeping alongside it, kept even at quantity 0 for history.
@Entity('product_batches')
@Index(['business_id'])
@Index(['product_id'])
@Index(['expiry_date'])
export class ProductBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Denormalized from product.business_id so batch queries can filter by
  // tenant directly, matching the convention used by ProductVariant.
  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_number: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date;

  // Remaining quantity in this batch — decremented FEFO on sale, credited
  // back on return, reduced by a write-off, incremented on re-receipt of
  // the same batch_number/expiry_date.
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quantity: number;

  // Originally received quantity (this batch's own receipts summed), kept
  // for audit/history display even as quantity is drawn down.
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  initial_quantity: number;

  // Per-unit cost for this specific batch — what receivePurchaseOrder paid,
  // so expiry-value-at-risk reflects the batch's own cost, not the product's
  // current purchase_price.
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  purchase_price: number;

  @Column({ type: 'uuid', nullable: true })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  // The PO this batch was originally received against, for traceability.
  @Column({ type: 'uuid', nullable: true })
  purchase_order_id: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @CreateDateColumn()
  received_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

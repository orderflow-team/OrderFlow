import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from './business.entity';
import { Supplier } from './supplier.entity';
import { Product } from './product.entity';
import { PurchaseOrder } from './purchase-order.entity';

/**
 * A debit note against a supplier for expired/damaged/wrong-item stock sent
 * back to them — distinct from InventoryService.adjustStock's plain
 * write-off, which only removes stock with no supplier-facing paper trail.
 * Still decrements Product/ProductBatch stock the same way a write-off does
 * (see InventoryService.returnToSupplier); this table is the register of
 * *why* and *to whom*, for reconciling against the supplier's own credit
 * note. Deliberately does not touch Supplier.outstanding_amount — that
 * field isn't populated anywhere else in the app yet (no PO ever increments
 * it), so decrementing it here would show a misleading number rather than a
 * real payable balance.
 */
@Entity('supplier_returns')
export class SupplierReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid' })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'uuid', nullable: true })
  purchase_order_id: string | null;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_number: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20 })
  reason: 'expired' | 'damaged' | 'wrong_item' | 'other';

  // Whether the supplier has actually issued a credit note / replacement
  // yet — staff-updated once resolved, so this doubles as a follow-up list.
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'credited';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}

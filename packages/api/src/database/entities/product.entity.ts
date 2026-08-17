import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Business } from './business.entity';
import { Supplier } from './supplier.entity';
import { ProductBatch } from './product-batch.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 50, default: 'piece' })
  unit: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  purchase_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  selling_price: number;

  // Manufacturer's printed Maximum Retail Price — reference only, shown
  // alongside selling_price so a wholesale rate can be compared against it.
  // Unlike ProductVariant.mrp, this is informational and not enforced as a ceiling.
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  mrp: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tax_percentage: number;

  // Harmonized System of Nomenclature code — required on a GST tax invoice
  // line item (CGST Rule 46(f)) once turnover crosses the HSN-mandatory
  // threshold. Free text since the exact digit count (4/6/8) businesses must
  // declare varies by their turnover slab.
  @Column({ type: 'varchar', length: 20, nullable: true })
  hsn_code: string | null;

  @Column({ type: 'int', default: 0 })
  stock_quantity: number;

  // Auto-synced summary of this product's ProductBatch rows: whichever
  // batch has the soonest expiry among batches that still have stock (see
  // InventoryService.syncProductBatchSummary). Not the source of truth —
  // that's the `batches` relation below — kept here so existing single-value
  // displays/queries keep working without a join.
  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_number: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date;

  // The supplier this product was most recently restocked from — set by
  // receivePurchaseOrder/updatePurchaseOrder, not a full batch-history trail.
  @Column({ type: 'uuid', nullable: true })
  last_supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'last_supplier_id' })
  last_supplier: Supplier;

  @OneToMany(() => ProductBatch, (batch) => batch.product)
  batches: ProductBatch[];

  // Generic/salt composition, e.g. "Paracetamol 500mg" — pharmacy-specific.
  @Column({ type: 'varchar', length: 255, nullable: true })
  generic_name: string;

  // Whether a doctor's prescription is required to sell this item (Rx vs OTC).
  @Column({ type: 'boolean', default: false })
  prescription_required: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url: string;

  @Column({ type: 'boolean', default: true })
  is_available: boolean;

  @Column({ type: 'boolean', default: false })
  is_draft: boolean;

  @Column({ type: 'boolean', default: false })
  is_archived: boolean;

  // Explicit price overrides keyed by canonical unit (e.g. "1kg", "500g") —
  // checked before falling back to proportional unit-conversion pricing.
  @Column({ type: 'jsonb', nullable: true })
  unit_prices: Record<string, number> | null;

  @Column({ type: 'jsonb', nullable: true })
  custom_fields: Record<string, any> | null;

  // Minimum Order Quantity (MOQ) for wholesale/bulk purchasing.
  @Column({ type: 'int', default: 1 })
  moq: number;

  // Manual per-product "needs reorder" threshold — null means fall back to
  // the app-wide default (see InventoryService.lowStock / ReportsService's
  // lowStockProducts queries, which COALESCE this against a flat 10).
  @Column({ type: 'int', nullable: true })
  reorder_point: number | null;

  // Volume pricing tiers, e.g. [{ minQty: 10, price: 420 }, { minQty: 50, price: 390 }].
  @Column({ type: 'jsonb', nullable: true })
  volume_tiers: { minQty: number; price: number }[] | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

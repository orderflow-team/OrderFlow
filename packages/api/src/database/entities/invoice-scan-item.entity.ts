import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InvoiceScan } from './invoice-scan.entity';
import { Product } from './product.entity';

@Entity('invoice_scan_items')
export class InvoiceScanItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scan_id: string;

  @ManyToOne(() => InvoiceScan, (scan) => scan.items)
  @JoinColumn({ name: 'scan_id' })
  scan: InvoiceScan;

  @Column({ type: 'varchar', length: 255 })
  raw_product_name: string;

  @Column({ type: 'uuid', nullable: true })
  matched_product_id: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'matched_product_id' })
  matched_product: Product;

  // Auto-flagged when raw_product_name matches an existing product in this
  // business's catalog, so the verify screen can pre-exclude likely duplicates.
  @Column({ type: 'boolean', default: false })
  is_duplicate: boolean;

  // User's final include/skip choice on the verify screen (defaults to the
  // inverse of is_duplicate, but the user can override either way).
  @Column({ type: 'boolean', default: true })
  included: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  scheme_quantity: number;

  // The distributor's billed per-unit rate — the real cost basis, used as purchase_price.
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  unit_price: number;

  // Printed maximum retail price — used as selling_price.
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  mrp: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_number: string;

  // Standardized "MM/YYYY" as extracted from the invoice.
  @Column({ type: 'varchar', length: 7, nullable: true })
  expiry_month_year: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;
}

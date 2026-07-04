import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from './business.entity';

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

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tax_percentage: number;

  @Column({ type: 'int', default: 0 })
  stock_quantity: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_number: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  is_available: boolean;

  @Column({ type: 'boolean', default: false })
  is_draft: boolean;

  // Explicit price overrides keyed by canonical unit (e.g. "1kg", "500g") —
  // checked before falling back to proportional unit-conversion pricing.
  @Column({ type: 'jsonb', nullable: true })
  unit_prices: Record<string, number> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

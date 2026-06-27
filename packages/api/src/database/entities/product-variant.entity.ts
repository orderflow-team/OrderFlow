import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Product } from './product.entity';
import { Business } from './business.entity';

@Entity('product_variants')
@Index(['business_id'])
@Index(['product_id'])
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Denormalized from product.business_id so variant queries can filter by
  // tenant directly (row-level isolation) without joining to products.
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

  // Label shown to the user, e.g. "1 Litre", "350ml", "5kg".
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Numeric packaging size, kept separate from the unit so it can be sorted/compared.
  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  volume_value: number;

  // Unit of measurement for volume_value: ml, ltr, g, kg, piece, etc.
  @Column({ type: 'varchar', length: 20, nullable: true })
  uom: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  cost_price: number;

  // Maximum Retail Price — hard ceiling that selling_price may never exceed.
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  mrp: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  selling_price: number;

  @Column({ type: 'int', default: 0 })
  stock_quantity: number;

  @Column({ type: 'boolean', default: true })
  is_available: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

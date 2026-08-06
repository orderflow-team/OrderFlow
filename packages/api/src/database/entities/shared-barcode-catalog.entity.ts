import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Cross-tenant (deliberately — the only such table in this app): the first
 * business to scan a given barcode and name a product for it contributes
 * that name/price here, so any other business scanning the same real-world
 * barcode gets it pre-filled instead of typing from scratch. First write
 * wins (see products.service.ts) — never silently overwritten.
 */
@Entity('shared_barcode_catalog')
export class SharedBarcodeCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  barcode: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  suggested_price: number | null;

  @CreateDateColumn()
  created_at: Date;
}

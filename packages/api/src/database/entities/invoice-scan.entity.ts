import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Business } from './business.entity';
import { Supplier } from './supplier.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { InvoiceScanItem } from './invoice-scan-item.entity';
import { InvoiceScanFile } from './invoice-scan-file.entity';

@Entity('invoice_scans')
export class InvoiceScan {
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

  @Column({ type: 'uuid', nullable: true })
  purchase_order_id: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  // Legacy single-file columns — kept for backward compatibility with scans
  // confirmed before multi-page support was added. New scans populate `files`
  // instead and leave these null.
  @Column({ type: 'text', nullable: true })
  file_url: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  file_type: string;

  @Column({ type: 'varchar', length: 20, default: 'processing' })
  status: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => InvoiceScanItem, (item) => item.scan)
  items: InvoiceScanItem[];

  @OneToMany(() => InvoiceScanFile, (file) => file.scan)
  files: InvoiceScanFile[];
}

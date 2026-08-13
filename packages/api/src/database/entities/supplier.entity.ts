import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from './business.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  // Set once a BusinessConnection to this supplier's real OBIX account is
  // accepted — purchase orders against this supplier then auto-mirror into
  // an Order on that business (see InventoryService.createPurchaseOrder).
  @Column({ type: 'uuid', nullable: true })
  linked_business_id: string | null;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'linked_business_id' })
  linked_business: Business;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_person: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  alternate_phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gst_number: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pan_number: string;

  // Distributor's drug license number(s) — pharmacy-specific, mirrors
  // Business.drug_license_number_1/_2 naming.
  @Column({ type: 'varchar', length: 50, nullable: true })
  drug_license_number: string;

  // Free string, e.g. 'distributor' | 'manufacturer' | 'wholesaler' | 'local_vendor'.
  @Column({ type: 'varchar', length: 50, nullable: true })
  supplier_type: string;

  // Same convention as Customer.payment_terms: a free string like
  // 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60'.
  @Column({ type: 'varchar', length: 50, nullable: true, default: 'due_on_receipt' })
  payment_terms: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit_limit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  outstanding_amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  trade_discount_percentage: number;

  // { accountName?, accountNumber?, ifsc?, bankName? } — grouped like
  // Product.custom_fields rather than four more flat columns.
  @Column({ type: 'jsonb', nullable: true })
  bank_details: Record<string, string> | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

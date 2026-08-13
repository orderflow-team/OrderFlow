import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from './business.entity';
import { Order } from './order.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid', nullable: true })
  order_id: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 50 })
  invoice_number: string;

  /** 'credit_note' rows reverse part of an 'invoice' row (same order_id) rather than billing anything new. */
  @Column({ type: 'varchar', length: 20, default: 'invoice' })
  type: 'invoice' | 'credit_note';

  /** Set only on credit_note rows — the original sale Invoice this note reverses. */
  @Column({ type: 'uuid', nullable: true })
  reference_invoice_id: string | null;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'reference_invoice_id' })
  reference_invoice: Invoice;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'text', nullable: true })
  pdf_url: string;

  /** Opaque random token for the unauthenticated public share link (WhatsApp/etc) — carries no decodable info, unlike a JWT payload. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  share_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  share_token_expires_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}

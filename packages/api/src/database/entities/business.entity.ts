import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  owner_user_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @Column({ type: 'boolean', default: true })
  inventory_enabled: boolean;

  @Column({ type: 'boolean', default: true })
  ai_chat_enabled: boolean;

  /** When false, an order requesting more than what's in stock is rejected instead of silently clamped to what's available. */
  @Column({ type: 'boolean', default: true })
  allow_orders_beyond_stock: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gst_number: string;

  // Pharmacy-specific: printed on the Cash Memo PDF invoice. Typically a
  // retail + a wholesale drug license, but left generic since not every
  // pharmacy holds both.
  @Column({ type: 'varchar', length: 50, nullable: true })
  drug_license_number_1: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  drug_license_number_2: string;

  // GST Rule 46 requires a tax invoice's serial number to be consecutive and
  // unique for a financial year — these track each numbering series's last
  // issued value and the FY it was issued in, so InvoicesService can bump
  // the counter atomically and reset it when the FY rolls over (see
  // InvoicesService.nextDocumentNumber).
  @Column({ type: 'varchar', length: 10, nullable: true })
  invoice_sequence_fy: string | null;

  @Column({ type: 'int', default: 0 })
  invoice_sequence_value: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  credit_note_sequence_fy: string | null;

  @Column({ type: 'int', default: 0 })
  credit_note_sequence_value: number;

  @Column({ type: 'varchar', default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', default: 'Asia/Kolkata' })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  logo_url: string;

  @Column({ type: 'text', nullable: true })
  upi_qr_url: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  // Off switch for the B2B linking feature (business-connections module) —
  // lets a business stop receiving connection requests without unlinking
  // any wholesalers/retailers it's already connected to.
  @Column({ type: 'boolean', default: true })
  b2b_sync_enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  custom_settings: Record<string, any>;

  // Per-notification-type opt-out (order_reminder, payment_reminder,
  // low_stock, expiry_alert — see notifications.service.ts). A type missing
  // from this map is enabled by default, so existing businesses with no
  // preference set yet keep getting everything exactly as before; only an
  // explicit `false` here suppresses that type (both the in-app row and the
  // push, notifications.service.ts's createNotification checks this before
  // either).
  @Column({ type: 'jsonb', nullable: true })
  notification_preferences: Record<string, boolean>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

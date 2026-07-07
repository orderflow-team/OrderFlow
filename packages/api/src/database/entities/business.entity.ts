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

  @Column({ type: 'varchar', length: 20, nullable: true })
  gst_number: string;

  @Column({ type: 'varchar', default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', default: 'Asia/Kolkata' })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  logo_url: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

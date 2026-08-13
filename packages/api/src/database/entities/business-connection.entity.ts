import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Business } from './business.entity';

// Direction is fixed per row since a purchase only ever flows retailer -> wholesaler:
// retailer_business_id is the buyer, wholesaler_business_id is the seller. Which side
// sent the request is tracked separately via initiated_by_business_id so only the
// recipient can accept/reject it.
@Entity('business_connections')
@Index(['retailer_business_id', 'wholesaler_business_id'], { unique: true })
export class BusinessConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  retailer_business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'retailer_business_id' })
  retailer_business: Business;

  @Column({ type: 'uuid' })
  wholesaler_business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'wholesaler_business_id' })
  wholesaler_business: Business;

  // 'pending' -> 'accepted' | 'rejected'. Only the recipient (the business that
  // is NOT initiated_by_business_id) can move it out of 'pending'.
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'uuid' })
  initiated_by_business_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

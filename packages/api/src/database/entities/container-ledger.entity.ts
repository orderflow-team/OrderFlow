import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type ContainerLedgerType = 'delivered' | 'returned' | 'adjustment';

/**
 * One movement of a returnable container (water jar, refill capsule…) between a business and a
 * customer. A customer's pending empties for a product is delivered − returned + adjustment (see
 * container-balance.util.ts); `adjustment` rows are signed, the other two are always positive.
 */
@Entity('container_ledger')
@Index('IDX_container_ledger_business_customer', ['business_id', 'customer_id'])
@Index('IDX_container_ledger_client_request', ['business_id', 'client_request_id'], { unique: true, where: '"client_request_id" IS NOT NULL' })
export class ContainerLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'varchar', length: 20 })
  type: ContainerLedgerType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Set by the offline outbox so a retried sync of the same queued return isn't recorded twice.
  @Column({ type: 'varchar', length: 100, nullable: true })
  client_request_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}

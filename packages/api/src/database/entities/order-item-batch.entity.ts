import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OrderItem } from './order-item.entity';
import { ProductBatch } from './product-batch.entity';

// Records which physical ProductBatch(es) an OrderItem's quantity was
// actually dispensed from — a sale can span more than one batch (FEFO may
// exhaust one batch mid-line and spill into the next), so this is a
// one-to-many allocation table rather than a single batch_id column on
// OrderItem. Written once at sale time in OrdersService (consumeBatchesFefo);
// never edited afterward. Exists specifically so a batch recall can answer
// "which orders/customers received this batch" — see InventoryController's
// batch-orders lookup.
@Entity('order_item_batches')
@Index(['batch_id'])
export class OrderItemBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  order_item_id: string;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  order_item: OrderItem;

  @Column({ type: 'uuid' })
  batch_id: string;

  @ManyToOne(() => ProductBatch)
  @JoinColumn({ name: 'batch_id' })
  batch: ProductBatch;

  // How many units of the OrderItem's quantity came from this specific batch.
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quantity: number;

  @CreateDateColumn()
  created_at: Date;
}

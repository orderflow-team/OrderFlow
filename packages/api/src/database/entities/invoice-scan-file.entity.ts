import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InvoiceScan } from './invoice-scan.entity';

// One row per uploaded page of a (possibly multi-page) invoice scan. Kept as
// a child table — same pattern as InvoiceScanItem — rather than a jsonb array
// on InvoiceScan, so page ordering/typing stay simple to reason about.
@Entity('invoice_scan_files')
export class InvoiceScanFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scan_id: string;

  @ManyToOne(() => InvoiceScan, (scan) => scan.files)
  @JoinColumn({ name: 'scan_id' })
  scan: InvoiceScan;

  @Column({ type: 'text' })
  file_url: string;

  @Column({ type: 'varchar', length: 20 })
  file_type: string;

  @Column({ type: 'int', default: 0 })
  page_order: number;

  @CreateDateColumn()
  created_at: Date;
}

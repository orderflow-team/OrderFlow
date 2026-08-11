import { IsString, IsOptional, IsNumber, IsUUID, IsIn, Min } from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  productId: string;

  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // When set, also adjusts this specific ProductBatch's remaining quantity
  // (in addition to the product's aggregate stock_quantity) — used by the
  // per-batch "write off" action in the pharmacy medicine catalog.
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

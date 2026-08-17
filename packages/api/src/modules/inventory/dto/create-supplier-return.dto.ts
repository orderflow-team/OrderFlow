import { IsString, IsOptional, IsNumber, IsUUID, IsIn, Min } from 'class-validator';

export class CreateSupplierReturnDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  supplierId: string;

  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsIn(['expired', 'damaged', 'wrong_item', 'other'])
  reason: 'expired' | 'damaged' | 'wrong_item' | 'other';

  @IsOptional()
  @IsString()
  notes?: string;
}

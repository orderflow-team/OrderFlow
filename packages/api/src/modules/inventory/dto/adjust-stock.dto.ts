import { IsString, IsOptional, IsNumber, IsUUID, IsIn } from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  productId: string;

  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

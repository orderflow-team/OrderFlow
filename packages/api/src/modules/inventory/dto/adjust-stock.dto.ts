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
}

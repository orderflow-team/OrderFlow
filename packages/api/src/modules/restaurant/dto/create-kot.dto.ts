import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateKotDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

import { IsString, IsOptional, IsNumber, IsUUID, IsBoolean, IsArray, ArrayMinSize, ValidateNested, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmInvoiceScanItemDto {
  @IsUUID()
  id: string;

  @IsBoolean()
  included: boolean;

  @IsString()
  productName: string;

  @IsOptional()
  @IsUUID()
  matchedProductId?: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  schemeQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @Matches(/^\d{2}\/\d{4}$/, { message: 'expiryMonthYear must be in MM/YYYY format' })
  expiryMonthYear?: string;
}

export class ConfirmInvoiceScanDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmInvoiceScanItemDto)
  items: ConfirmInvoiceScanItemDto[];
}

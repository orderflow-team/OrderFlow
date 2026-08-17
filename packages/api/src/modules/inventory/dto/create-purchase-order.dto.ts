import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsDateString,
  Min,
  ValidateNested,
  ArrayMinSize,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  // Which supplier this specific line came from — defaults to the PO's
  // supplierId when omitted (set in InventoryService.createPurchaseOrder).
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  schemeQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercentage?: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}

import { IsOptional, IsString, IsUUID, ValidateNested, ArrayMinSize, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseItemDto } from './create-purchase-order.dto';

// Extends the same per-line shape used on create, plus an optional `id`:
// present => update that existing line; absent => a new line. Any existing
// line whose id isn't present in the submitted array is treated as removed.
export class UpdatePurchaseItemDto extends PurchaseItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseItemDto)
  items: UpdatePurchaseItemDto[];
}

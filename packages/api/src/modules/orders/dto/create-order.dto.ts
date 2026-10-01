import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  IsArray,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  customProductName?: string;

  // Upper bounds keep a typo'd or hostile value from overflowing the
  // decimal(15,2) order columns (a raw 500) — 1M covers gram-level quantities.
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  unitPrice?: number;
}

export class CreateOrderDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsString()
  customerName: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsNumber()
  guestCount?: number;

  @IsOptional()
  @IsString()
  orderType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional()
  @IsString()
  doctorName?: string;

  @IsOptional()
  @IsString()
  doctorRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  prescriptionImageKey?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  // Set by the offline outbox (apps/web/lib/offline-db.ts) so a retried sync
  // of the same queued sale is recognized as the same order, not a duplicate.
  @IsOptional()
  @IsString()
  clientRequestId?: string;
}

export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class ReturnOrderItemDto {
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;
}

export class ReturnOrderDto {
  // Which items — and how many units of each — to return. Omitted (or a quantity
  // covering every unit still outstanding) returns the whole order; anything less
  // does a partial return of just those units.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnOrderItemDto)
  items?: ReturnOrderItemDto[];
}

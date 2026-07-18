import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
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

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
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

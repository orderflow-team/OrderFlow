import { IsString, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';

export class CreateProductVariantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeValue?: number;

  @IsOptional()
  @IsString()
  uom?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsNumber()
  @Min(0)
  mrp: number;

  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

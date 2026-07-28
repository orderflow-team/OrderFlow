import { IsString, IsOptional, IsNumber, IsUUID, Min, Matches } from 'class-validator';

export class CreateCustomerDto {
  @IsUUID()
  businessId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tradeDiscountPercentage?: number;
}

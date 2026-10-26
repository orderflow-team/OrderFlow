import { IsString, IsOptional, IsNumber, IsUUID, IsIn, Min, Matches } from 'class-validator';
import { IsGstin } from '../../../common/validators/is-gstin.validator';

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
  @IsGstin()
  gstNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  // Pre-selected fulfillment on this customer's new orders (e.g. someone who always collects).
  @IsOptional()
  @IsIn(['delivery', 'pickup'])
  defaultFulfillment?: 'delivery' | 'pickup';

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

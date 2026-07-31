import { IsString, IsOptional, IsNumber, IsUUID, IsIn, Min } from 'class-validator';
import { PAYMENT_METHODS } from './create-payment.dto';

export class PayTotalDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  customerId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string;
}

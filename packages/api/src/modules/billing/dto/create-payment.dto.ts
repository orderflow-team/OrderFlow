import { IsString, IsOptional, IsNumber, IsUUID, IsIn, Min, Max } from 'class-validator';

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Credit'] as const;

export class CreatePaymentDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsNumber()
  @Min(0.01)
  // The amount column is numeric(15,2); a larger value used to surface as a 500.
  @Max(99_999_999)
  amount: number;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  transactionId?: string;

  // Set by the offline outbox (apps/web/lib/offline-db.ts) so a retried sync
  // of the same queued payment is recognized instead of double-recording it.
  @IsOptional()
  @IsString()
  clientRequestId?: string;
}

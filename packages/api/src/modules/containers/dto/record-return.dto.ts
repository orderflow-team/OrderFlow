import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class RecordReturnDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  customerId: string;

  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // Set by the offline outbox so a retried sync of the same queued return is recorded once.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientRequestId?: string;
}

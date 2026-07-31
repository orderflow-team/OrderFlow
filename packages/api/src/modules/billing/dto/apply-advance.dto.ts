import { IsUUID } from 'class-validator';

export class ApplyAdvanceDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  customerId: string;
}

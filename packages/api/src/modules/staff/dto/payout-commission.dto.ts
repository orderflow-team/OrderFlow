import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class PayoutCommissionDto {
  @IsNotEmpty()
  @IsUUID()
  businessId: string;

  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true })
  commissionIds: string[];
}

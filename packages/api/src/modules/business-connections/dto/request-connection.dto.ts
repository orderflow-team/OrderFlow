import { IsIn, IsString, IsUUID } from 'class-validator';

export class RequestConnectionDto {
  @IsUUID()
  businessId: string;

  @IsString()
  targetPhone: string;

  // My role in the relationship being requested: 'retailer' means the business
  // found by targetPhone is being added as my wholesaler; 'wholesaler' means
  // it's being added as my retailer.
  @IsIn(['retailer', 'wholesaler'])
  role: 'retailer' | 'wholesaler';
}

import { IsUUID } from 'class-validator';

export class ConnectionBusinessScopeDto {
  @IsUUID()
  businessId: string;
}

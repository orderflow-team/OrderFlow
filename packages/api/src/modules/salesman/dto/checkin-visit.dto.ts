import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CheckinVisitDto {
  @IsUUID()
  salesmanId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  gpsLocation?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

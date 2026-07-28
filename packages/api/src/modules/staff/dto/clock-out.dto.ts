import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ClockOutDto {
  @IsNotEmpty()
  @IsUUID()
  businessId: string;

  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

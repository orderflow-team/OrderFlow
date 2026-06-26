import { IsString, IsOptional, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateTableDto {
  @IsUUID()
  businessId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;
}

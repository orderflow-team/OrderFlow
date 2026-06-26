import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateSalesmanDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  route?: string;
}

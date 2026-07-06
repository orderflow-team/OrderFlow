import { IsString, IsOptional, IsUUID, IsEmail, MinLength } from 'class-validator';

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

  // When provided together, a login is created for this salesman scoped to
  // the same business as the owner — no separate account, so products,
  // customers, and pricing are always the same live data the owner sees.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;
}

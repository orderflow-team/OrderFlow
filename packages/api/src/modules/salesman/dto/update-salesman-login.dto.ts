import { IsEmail, IsOptional, MinLength } from 'class-validator';

export class UpdateSalesmanLoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;
}

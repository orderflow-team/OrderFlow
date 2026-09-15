import { IsEmail, IsString, MinLength, IsOptional, IsUUID } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(6)
  code: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsUUID()
  businessId?: string;
}

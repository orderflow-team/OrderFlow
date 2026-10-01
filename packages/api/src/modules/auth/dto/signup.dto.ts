import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

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

  // There is deliberately NO businessId here. It used to be accepted and stored
  // on the new ADMIN account unchecked, so anyone could sign up as an admin of
  // any shop whose id they knew (shop ids are public: takeaway QR links,
  // phone lookup). New accounts onboard their own business after signing up.
}

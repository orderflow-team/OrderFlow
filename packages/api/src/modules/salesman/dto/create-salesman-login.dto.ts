import { IsEmail, MinLength } from 'class-validator';

export class CreateSalesmanLoginDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}

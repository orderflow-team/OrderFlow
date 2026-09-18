import { IsString, IsOptional } from 'class-validator';

export class GoogleAuthDto {
  @IsOptional()
  @IsString()
  idToken?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  businessName?: string;
}


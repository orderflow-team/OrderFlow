import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  drugLicenseNumber1?: string;

  @IsOptional()
  @IsString()
  drugLicenseNumber2?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  inventoryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  aiChatEnabled?: boolean;

  @IsOptional()
  customSettings?: Record<string, any>;
}

import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { IsGstin } from '../../../common/validators/is-gstin.validator';

export class CreateBusinessDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @IsGstin()
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
  @IsBoolean()
  allowOrdersBeyondStock?: boolean;

  @IsOptional()
  @IsBoolean()
  b2bSyncEnabled?: boolean;

  @IsOptional()
  customSettings?: Record<string, any>;
}

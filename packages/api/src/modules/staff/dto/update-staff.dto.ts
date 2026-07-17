import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ALLOWED_STAFF_ROLES } from '../staff-roles.const';

export class UpdateStaffDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(ALLOWED_STAFF_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

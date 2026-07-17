import { IsEmail, IsIn, IsNotEmpty, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ALLOWED_STAFF_ROLES } from '../staff-roles.const';

export class CreateStaffDto {
  @IsUUID()
  businessId: string;

  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsIn(ALLOWED_STAFF_ROLES)
  role: UserRole;
}

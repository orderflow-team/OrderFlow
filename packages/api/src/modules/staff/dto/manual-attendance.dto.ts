import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { AttendanceStatus } from '../../../database/entities/attendance.entity';

export class ManualAttendanceDto {
  @IsNotEmpty()
  @IsUUID()
  businessId: string;

  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  date: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

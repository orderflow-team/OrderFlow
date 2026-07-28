import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Attendance } from '../../database/entities/attendance.entity';
import { Commission } from '../../database/entities/commission.entity';
import { Order } from '../../database/entities/order.entity';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { AttendanceService } from './services/attendance.service';
import { CommissionsService } from './services/commissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Attendance, Commission, Order])],
  controllers: [StaffController],
  providers: [StaffService, AttendanceService, CommissionsService],
  exports: [StaffService, AttendanceService, CommissionsService],
})
export class StaffModule {}

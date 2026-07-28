import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance, AttendanceStatus } from '../../../database/entities/attendance.entity';
import { User } from '../../../database/entities/user.entity';
import { ClockInDto } from '../dto/clock-in.dto';
import { ClockOutDto } from '../dto/clock-out.dto';
import { ManualAttendanceDto } from '../dto/manual-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance) private attendanceRepository: Repository<Attendance>,
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  private getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async clockIn(dto: ClockInDto) {
    const user = await this.usersRepository.findOne({ where: { id: dto.userId, business_id: dto.businessId } });
    if (!user) {
      throw new NotFoundException('Staff member not found');
    }

    const todayStr = this.getTodayString();
    let record = await this.attendanceRepository.findOne({
      where: { business_id: dto.businessId, user_id: dto.userId, date: todayStr },
    });

    if (record && record.clock_in) {
      throw new ConflictException('Already clocked in for today');
    }

    if (!record) {
      record = this.attendanceRepository.create({
        business_id: dto.businessId,
        user_id: dto.userId,
        date: todayStr,
        status: AttendanceStatus.PRESENT,
      });
    }

    record.clock_in = new Date();
    record.notes = dto.notes || record.notes;
    return this.attendanceRepository.save(record);
  }

  async clockOut(dto: ClockOutDto) {
    const todayStr = this.getTodayString();
    const record = await this.attendanceRepository.findOne({
      where: { business_id: dto.businessId, user_id: dto.userId, date: todayStr },
    });

    if (!record || !record.clock_in) {
      throw new BadRequestException('No active clock-in record found for today');
    }

    if (record.clock_out) {
      throw new ConflictException('Already clocked out for today');
    }

    const clockOutTime = new Date();
    record.clock_out = clockOutTime;
    const diffMs = clockOutTime.getTime() - new Date(record.clock_in).getTime();
    record.shift_hours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    record.notes = dto.notes || record.notes;

    return this.attendanceRepository.save(record);
  }

  async getRoster(businessId: string, date?: string, userId?: string) {
    const query = this.attendanceRepository
      .createQueryBuilder('att')
      .innerJoinAndSelect('att.user', 'user')
      .where('att.business_id = :businessId', { businessId });

    if (date) {
      query.andWhere('att.date = :date', { date });
    }

    if (userId) {
      query.andWhere('att.user_id = :userId', { userId });
    }

    query.orderBy('att.date', 'DESC').addOrderBy('att.created_at', 'DESC');
    return query.getMany();
  }

  async markManual(dto: ManualAttendanceDto) {
    const user = await this.usersRepository.findOne({ where: { id: dto.userId, business_id: dto.businessId } });
    if (!user) {
      throw new NotFoundException('Staff member not found');
    }

    let record = await this.attendanceRepository.findOne({
      where: { business_id: dto.businessId, user_id: dto.userId, date: dto.date },
    });

    if (!record) {
      record = this.attendanceRepository.create({
        business_id: dto.businessId,
        user_id: dto.userId,
        date: dto.date,
      });
    }

    record.status = dto.status;
    record.notes = dto.notes || record.notes;
    return this.attendanceRepository.save(record);
  }
}

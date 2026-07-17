import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../database/entities/user.entity';
import { encryptPassword, decryptPassword } from '../../common/utils/credential-crypto.util';
import { ALLOWED_STAFF_ROLES } from './staff-roles.const';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(@InjectRepository(User) private usersRepository: Repository<User>) {}

  async create(businessId: string, dto: CreateStaffDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email: ILike(normalizedEmail) } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: normalizedEmail,
      password_hash,
      password_plain: encryptPassword(dto.password),
      full_name: dto.name,
      business_id: businessId,
      role: dto.role,
    });
    const saved = await this.usersRepository.save(user);
    return { id: saved.id, email: saved.email, fullName: saved.full_name, role: saved.role, isActive: saved.is_active };
  }

  async findAll(businessId: string) {
    const staff = await this.usersRepository.find({
      where: { business_id: businessId, role: In([...ALLOWED_STAFF_ROLES]) },
      order: { created_at: 'ASC' },
    });
    return staff.map((u) => ({ id: u.id, email: u.email, fullName: u.full_name, role: u.role, isActive: u.is_active }));
  }

  private async findStaffUser(id: string, businessId: string, select?: Record<string, boolean>) {
    const user = await this.usersRepository.findOne({
      where: { id, business_id: businessId, role: In([...ALLOWED_STAFF_ROLES]) },
      ...(select ? { select } : {}),
    });
    if (!user) {
      throw new NotFoundException('Staff member not found');
    }
    return user;
  }

  /** Owner-only: reveal the current plaintext password for a staff login. */
  async getCredentials(id: string, businessId: string) {
    const user = await this.findStaffUser(id, businessId, { id: true, email: true, password_plain: true });
    return { email: user.email, password: user.password_plain ? decryptPassword(user.password_plain) : null };
  }

  async update(id: string, businessId: string, dto: UpdateStaffDto) {
    const user = await this.findStaffUser(id, businessId);
    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.usersRepository.findOne({ where: { email: ILike(normalizedEmail) } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Email already registered');
      }
      user.email = normalizedEmail;
    }
    if (dto.name) {
      user.full_name = dto.name;
    }
    if (dto.role) {
      user.role = dto.role;
    }
    if (typeof dto.isActive === 'boolean') {
      user.is_active = dto.isActive;
    }
    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
      user.password_plain = encryptPassword(dto.password);
    }
    const saved = await this.usersRepository.save(user);
    return { id: saved.id, email: saved.email, fullName: saved.full_name, role: saved.role, isActive: saved.is_active };
  }

  /** Soft-deactivate rather than hard-delete — the same convention used for salesman/kitchen-staff logins, since orders/notifications may reference this user. */
  async remove(id: string, businessId: string) {
    const user = await this.findStaffUser(id, businessId);
    user.is_active = false;
    await this.usersRepository.save(user);
    return { deleted: true };
  }
}

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Salesman } from '../../database/entities/salesman.entity';
import { Visit } from '../../database/entities/visit.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { encryptPassword, decryptPassword } from '../../common/utils/credential-crypto.util';
import { CreateSalesmanDto } from './dto/create-salesman.dto';
import { CheckinVisitDto } from './dto/checkin-visit.dto';
import { CreateSalesmanLoginDto } from './dto/create-salesman-login.dto';
import { UpdateSalesmanLoginDto } from './dto/update-salesman-login.dto';

@Injectable()
export class SalesmanService {
  constructor(
    @InjectRepository(Salesman) private salesmenRepository: Repository<Salesman>,
    @InjectRepository(Visit) private visitsRepository: Repository<Visit>,
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateSalesmanDto) {
    let userId = dto.userId;
    if (dto.email && dto.password) {
      const user = await this.createLoginUser(dto.businessId, dto.name, dto.email, dto.password);
      userId = user.id;
    }

    const salesman = this.salesmenRepository.create({
      business_id: dto.businessId,
      user_id: userId,
      name: dto.name,
      phone: dto.phone,
      route: dto.route,
    });
    return this.salesmenRepository.save(salesman);
  }

  /**
   * Gives an already-existing salesman a real login, scoped to the SAME
   * business as the owner — so products/customers/pricing are always the
   * live data the owner sees, with no cross-business sync to maintain.
   */
  async createLogin(id: string, businessId: string, dto: CreateSalesmanLoginDto) {
    const salesman = await this.findOne(id, businessId);
    if (salesman.user_id) {
      throw new ConflictException('This salesman already has a login');
    }
    const user = await this.createLoginUser(businessId, salesman.name, dto.email, dto.password);
    salesman.user_id = user.id;
    await this.salesmenRepository.save(salesman);
    return { id: user.id, email: user.email };
  }

  private async createLoginUser(businessId: string, name: string, email: string, password: string) {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email: ILike(normalizedEmail) } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      email: normalizedEmail,
      password_hash,
      password_plain: encryptPassword(password),
      full_name: name,
      business_id: businessId,
      role: UserRole.SALESMAN,
    });
    return this.usersRepository.save(user);
  }

  async findAll(businessId: string) {
    const salesmen = await this.salesmenRepository.find({
      where: { business_id: businessId },
      relations: { user: true },
      order: { name: 'ASC' },
    });
    return salesmen.map((s) => ({ ...s, email: s.user?.email ?? null }));
  }

  /** Owner-only: reveal the current plaintext password for a salesman's login. */
  async getLoginCredentials(id: string, businessId: string) {
    const salesman = await this.findOne(id, businessId);
    if (!salesman.user_id) {
      throw new NotFoundException('This salesman has no login');
    }
    const user = await this.usersRepository.findOne({
      where: { id: salesman.user_id },
      select: { id: true, email: true, password_plain: true },
    });
    if (!user) {
      throw new NotFoundException('Login not found');
    }
    return { email: user.email, password: user.password_plain ? decryptPassword(user.password_plain) : null };
  }

  /** Owner-only: change the email and/or password of a salesman's existing login. */
  async updateLogin(id: string, businessId: string, dto: UpdateSalesmanLoginDto) {
    const salesman = await this.findOne(id, businessId);
    if (!salesman.user_id) {
      throw new NotFoundException('This salesman has no login');
    }
    const user = await this.usersRepository.findOne({ where: { id: salesman.user_id } });
    if (!user) {
      throw new NotFoundException('Login not found');
    }
    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.usersRepository.findOne({ where: { email: ILike(normalizedEmail) } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Email already registered');
      }
      user.email = normalizedEmail;
    }
    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
      user.password_plain = encryptPassword(dto.password);
    }
    const saved = await this.usersRepository.save(user);
    return { id: saved.id, email: saved.email };
  }

  async findOne(id: string, businessId: string) {
    const salesman = await this.salesmenRepository.findOne({ where: { id, business_id: businessId } });
    if (!salesman) {
      throw new NotFoundException('Salesman not found');
    }
    return salesman;
  }

  /** Visits reference the salesman with no cascade at the app level, so they're removed first. The linked login (if any) is deactivated rather than deleted, since other records (orders, notifications) may reference it. */
  async remove(id: string, businessId: string) {
    const salesman = await this.findOne(id, businessId);
    await this.visitsRepository.delete({ salesman_id: id });
    if (salesman.user_id) {
      await this.usersRepository.update({ id: salesman.user_id }, { is_active: false });
    }
    await this.salesmenRepository.remove(salesman);
    return { deleted: true };
  }

  async checkIn(dto: CheckinVisitDto) {
    // Confirms the salesman actually belongs to the caller's business before
    // opening a visit against them.
    await this.findOne(dto.salesmanId, dto.businessId);

    const openVisit = await this.visitsRepository.findOne({
      where: { salesman_id: dto.salesmanId, check_out_time: IsNull() },
    });
    if (openVisit) {
      throw new ConflictException('This salesman already has an open visit — check out first');
    }

    const visit = this.visitsRepository.create({
      salesman_id: dto.salesmanId,
      customer_id: dto.customerId,
      check_in_time: new Date(),
      gps_location: dto.gpsLocation,
      notes: dto.notes,
    });
    return this.visitsRepository.save(visit);
  }

  async checkOut(id: string, businessId: string) {
    const visit = await this.visitsRepository
      .createQueryBuilder('visit')
      .innerJoin('visit.salesman', 'salesman')
      .where('visit.id = :id', { id })
      .andWhere('salesman.business_id = :businessId', { businessId })
      .getOne();
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (visit.check_out_time) {
      throw new BadRequestException('Visit already checked out');
    }
    visit.check_out_time = new Date();
    return this.visitsRepository.save(visit);
  }

  async findVisitsBySalesman(salesmanId: string, businessId: string) {
    await this.findOne(salesmanId, businessId);
    return this.visitsRepository.find({ where: { salesman_id: salesmanId }, order: { created_at: 'DESC' } });
  }

  findVisitsByCustomer(customerId: string, businessId: string) {
    return this.visitsRepository
      .createQueryBuilder('visit')
      .innerJoin('visit.salesman', 'salesman')
      .where('visit.customer_id = :customerId', { customerId })
      .andWhere('salesman.business_id = :businessId', { businessId })
      .orderBy('visit.created_at', 'DESC')
      .getMany();
  }
}

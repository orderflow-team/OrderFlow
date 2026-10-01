import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { emailMatches } from '../../common/utils/email-match.util';
import { InjectRepository } from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Table } from '../../database/entities/table.entity';
import { KOT } from '../../database/entities/kot.entity';
import { Order } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { encryptPassword, decryptPassword } from '../../common/utils/credential-crypto.util';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { CreateKotDto } from './dto/create-kot.dto';
import { UpdateKotStatusDto, KOT_STATUSES } from './dto/update-kot-status.dto';
import { CreateKitchenStaffLoginDto } from './dto/create-kitchen-staff-login.dto';
import { UpdateKitchenStaffLoginDto } from './dto/update-kitchen-staff-login.dto';

type KotStatus = (typeof KOT_STATUSES)[number];

/** Forward-only kitchen workflow — no skipping ahead or reverting a ticket. */
const KOT_STATUS_TRANSITIONS: Record<KotStatus, KotStatus[]> = {
  pending: ['preparing'],
  preparing: ['ready'],
  ready: ['served'],
  served: [],
};

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(Table) private tablesRepository: Repository<Table>,
    @InjectRepository(KOT) private kotRepository: Repository<KOT>,
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  /**
   * A cook only ever needs to see/update KOTs — no visit-tracking or profile
   * data like a salesman, so this creates a bare login (no linked domain
   * entity) scoped to the SAME business as the owner.
   */
  async createKitchenStaffLogin(businessId: string, dto: CreateKitchenStaffLoginDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email: emailMatches(email) } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email,
      password_hash,
      password_plain: encryptPassword(dto.password),
      full_name: dto.name,
      business_id: businessId,
      role: UserRole.KITCHEN_STAFF,
    });
    const saved = await this.usersRepository.save(user);
    return { id: saved.id, email: saved.email, fullName: saved.full_name };
  }

  async listKitchenStaff(businessId: string) {
    const users = await this.usersRepository.find({
      where: { business_id: businessId, role: UserRole.KITCHEN_STAFF },
      order: { created_at: 'ASC' },
    });
    return users.map((u) => ({ id: u.id, email: u.email, fullName: u.full_name, isActive: u.is_active }));
  }

  private async findKitchenStaffUser(userId: string, businessId: string, select?: Record<string, boolean>) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, business_id: businessId, role: UserRole.KITCHEN_STAFF },
      ...(select ? { select } : {}),
    });
    if (!user) {
      throw new NotFoundException('Kitchen staff login not found');
    }
    return user;
  }

  /** Owner-only: reveal the current plaintext password for a cook's login. */
  async getKitchenStaffCredentials(userId: string, businessId: string) {
    const user = await this.findKitchenStaffUser(userId, businessId, { id: true, email: true, password_plain: true });
    return { email: user.email, password: user.password_plain ? decryptPassword(user.password_plain) : null };
  }

  /** Owner-only: change the name/email/password of a cook's existing login. */
  async updateKitchenStaffLogin(userId: string, businessId: string, dto: UpdateKitchenStaffLoginDto) {
    const user = await this.findKitchenStaffUser(userId, businessId);
    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.usersRepository.findOne({ where: { email: emailMatches(normalizedEmail) } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Email already registered');
      }
      user.email = normalizedEmail;
    }
    if (dto.name) {
      user.full_name = dto.name;
    }
    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
      // A reset must sign the old password's sessions out (see AuthService.invalidateExistingSessions).
      user.sessions_valid_after = String(Math.floor(Date.now() / 1000));
      user.password_plain = encryptPassword(dto.password);
    }
    const saved = await this.usersRepository.save(user);
    return { id: saved.id, email: saved.email, fullName: saved.full_name };
  }

  createTable(dto: CreateTableDto) {
    const table = this.tablesRepository.create({
      business_id: dto.businessId,
      name: dto.name,
      capacity: dto.capacity ?? 4,
    });
    return this.tablesRepository.save(table);
  }

  findAllTables(businessId: string, status?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (status) {
      where.status = status;
    }
    return this.tablesRepository.find({ where, order: { name: 'ASC' } });
  }

  async updateTableStatus(id: string, businessId: string, dto: UpdateTableStatusDto) {
    const table = await this.tablesRepository.findOne({ where: { id, business_id: businessId } });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    table.status = dto.status;
    return this.tablesRepository.save(table);
  }

  /** kot.table_id and orders.table_id have no FK cascade, so both are nulled out first rather than blocking the delete. */
  async deleteTable(id: string, businessId: string) {
    const table = await this.tablesRepository.findOne({ where: { id, business_id: businessId } });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    await this.kotRepository.update({ table_id: id }, { table_id: null as unknown as string });
    await this.kotRepository.manager.getRepository(Order).update({ table_id: id }, { table_id: null as unknown as string });
    await this.tablesRepository.remove(table);
    return { deleted: true };
  }

  /** Occupies the table for a new order's KOT, per the Restaurant Module flow. */
  async createKot(dto: CreateKotDto) {
    // findAllKots returns the linked order in full, so a KOT pointing at another
    // shop's order id would hand that order's customer/totals/notes back. The
    // order and table must belong to this business.
    if (dto.orderId) {
      const ownedOrders = await this.kotRepository.manager.getRepository(Order).count({
        where: { id: dto.orderId, business_id: dto.businessId },
      });
      if (!ownedOrders) {
        throw new BadRequestException('Order not found');
      }
    }
    if (dto.tableId) {
      const ownedTables = await this.tablesRepository.count({
        where: { id: dto.tableId, business_id: dto.businessId },
      });
      if (!ownedTables) {
        throw new BadRequestException('Table not found');
      }
    }

    const kot = this.kotRepository.create({
      business_id: dto.businessId,
      order_id: dto.orderId,
      table_id: dto.tableId,
      status: 'pending',
      notes: dto.notes,
    });
    const saved = await this.kotRepository.save(kot);

    if (dto.tableId) {
      await this.tablesRepository.update({ id: dto.tableId, business_id: dto.businessId }, { status: 'occupied' });
    }

    return saved;
  }

  findAllKots(businessId: string, status?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (status) {
      where.status = status;
    }
    return this.kotRepository.find({ 
      where, 
      relations: { table: true, order: true, items: { product: true } },
      order: { created_at: 'ASC' } 
    });
  }

  /** Releasing the table happens once the KOT is served and the bill is settled. */
  async updateKotStatus(id: string, businessId: string, dto: UpdateKotStatusDto) {
    const kot = await this.kotRepository.findOne({ where: { id, business_id: businessId } });
    if (!kot) {
      throw new NotFoundException('KOT not found');
    }
    const allowedNextStatuses = KOT_STATUS_TRANSITIONS[kot.status as KotStatus];
    if (!allowedNextStatuses?.includes(dto.status as KotStatus)) {
      throw new BadRequestException(`Cannot move a KOT from "${kot.status}" to "${dto.status}"`);
    }
    kot.status = dto.status;
    return this.kotRepository.save(kot);
  }

  async releaseTable(id: string, businessId: string) {
    const table = await this.tablesRepository.findOne({ where: { id, business_id: businessId } });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    table.status = 'available';
    return this.tablesRepository.save(table);
  }
}

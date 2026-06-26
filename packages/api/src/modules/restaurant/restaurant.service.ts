import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from '../../database/entities/table.entity';
import { KOT } from '../../database/entities/kot.entity';
import { Order } from '../../database/entities/order.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { CreateKotDto } from './dto/create-kot.dto';
import { UpdateKotStatusDto } from './dto/update-kot-status.dto';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(Table) private tablesRepository: Repository<Table>,
    @InjectRepository(KOT) private kotRepository: Repository<KOT>,
  ) {}

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

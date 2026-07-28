import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Business, User, Product, Order, UserActivityLog } from '../../database/entities';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(UserActivityLog)
    private readonly activityLogRepo: Repository<UserActivityLog>,
  ) {}

  /**
   * Log platform admin or user activity
   */
  async logActivity(
    action: string,
    userId?: string,
    businessId?: string,
    resource?: string,
    metadata?: Record<string, any>,
    ip_address?: string,
  ) {
    try {
      const log = this.activityLogRepo.create({
        action,
        user_id: userId,
        business_id: businessId,
        resource,
        metadata,
        ip_address,
      });
      await this.activityLogRepo.save(log);
    } catch (err) {
      console.error('Failed to save activity log:', err);
    }
  }

  /**
   * Platform Overview Stats
   */
  async getOverviewStats() {
    const totalStores = await this.businessRepo.count();
    const activeStores = await this.businessRepo.count({ where: { inventory_enabled: true } }); // Or active flag
    
    const totalUsers = await this.userRepo.count();
    const activeUsers = await this.userRepo.count({ where: { is_active: true } });
    
    const totalProducts = await this.productRepo.count();
    const totalOrders = await this.orderRepo.count();

    const revenueResult = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.total_amount)', 'sum')
      .getRawOne();
    
    const totalRevenue = parseFloat(revenueResult?.sum || '0');

    const recentSignups = await this.userRepo.find({
      relations: ['business'],
      order: { created_at: 'DESC' },
      take: 5,
    });

    const recentActivities = await this.activityLogRepo.find({
      relations: ['user', 'business'],
      order: { created_at: 'DESC' },
      take: 10,
    });

    return {
      stats: {
        totalStores,
        activeStores,
        totalUsers,
        activeUsers,
        totalProducts,
        totalOrders,
        totalRevenue,
      },
      recentSignups: recentSignups.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        business_name: u.business?.name || 'N/A',
        created_at: u.created_at,
      })),
      recentActivities,
    };
  }

  /**
   * Get All Users Data in Tabular Form
   */
  async getAllUsers(query: {
    search?: string;
    role?: string;
    business_id?: string;
    is_active?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.business', 'business')
      .orderBy('user.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('(user.full_name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.business_id) {
      qb.andWhere('user.business_id = :bId', { bId: query.business_id });
    }

    if (query.is_active !== undefined && query.is_active !== '') {
      const isActive = query.is_active === 'true';
      qb.andWhere('user.is_active = :isActive', { isActive });
    }

    const [users, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: users.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        business_id: u.business_id,
        business_name: u.business?.name || 'N/A',
        created_at: u.created_at,
        updated_at: u.updated_at,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update User details (Full Edit, Role change, Store reassignment, Password Reset, Status toggle)
   */
  async updateUser(
    userId: string,
    dto: {
      full_name?: string;
      email?: string;
      role?: UserRole;
      business_id?: string;
      is_active?: boolean;
      password?: string;
    },
    adminUserId?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['business'] });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const changes: Record<string, any> = {};

    if (dto.full_name !== undefined) {
      changes.full_name = { old: user.full_name, new: dto.full_name };
      user.full_name = dto.full_name;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.email } });
      if (existing && existing.id !== userId) {
        throw new BadRequestException(`Email ${dto.email} is already in use`);
      }
      changes.email = { old: user.email, new: dto.email };
      user.email = dto.email;
    }

    if (dto.role !== undefined) {
      changes.role = { old: user.role, new: dto.role };
      user.role = dto.role;
    }

    if (dto.business_id !== undefined) {
      changes.business_id = { old: user.business_id, new: dto.business_id };
      user.business_id = dto.business_id;
    }

    if (dto.is_active !== undefined) {
      changes.is_active = { old: user.is_active, new: dto.is_active };
      user.is_active = dto.is_active;
    }

    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
      user.password_plain = dto.password;
      changes.password_reset = true;
    }

    const updatedUser = await this.userRepo.save(user);

    await this.logActivity(
      'UPDATE_USER',
      adminUserId,
      user.business_id,
      'User',
      { target_user_id: user.id, target_user_email: user.email, changes },
    );

    return {
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
        business_id: updatedUser.business_id,
        updated_at: updatedUser.updated_at,
      },
    };
  }

  /**
   * Toggle User Active/Disabled status
   */
  async toggleUserStatus(userId: string, is_active: boolean, adminUserId?: string) {
    return this.updateUser(userId, { is_active }, adminUserId);
  }

  /**
   * Get All Stores/Businesses List
   */
  async getAllStores(query: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.businessRepo.createQueryBuilder('business').orderBy('business.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('(business.name ILIKE :search OR business.category ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [stores, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Fetch counts for users and products for each store
    const storeData = await Promise.all(
      stores.map(async (store) => {
        const userCount = await this.userRepo.count({ where: { business_id: store.id } });
        const productCount = await this.productRepo.count({ where: { business_id: store.id } });
        const orderCount = await this.orderRepo.count({ where: { business_id: store.id } });

        return {
          ...store,
          user_count: userCount,
          product_count: productCount,
          order_count: orderCount,
        };
      }),
    );

    return {
      data: storeData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update Store Settings & Feature Toggles
   */
  async updateStore(
    storeId: string,
    dto: {
      name?: string;
      category?: string;
      inventory_enabled?: boolean;
      ai_chat_enabled?: boolean;
      gst_number?: string;
    },
    adminUserId?: string,
  ) {
    const store = await this.businessRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    Object.assign(store, dto);
    const updated = await this.businessRepo.save(store);

    await this.logActivity('UPDATE_STORE', adminUserId, storeId, 'Business', { dto });

    return updated;
  }

  /**
   * Activity & Audit Logs
   */
  async getActivityLogs(query: { action?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('log.business', 'business')
      .orderBy('log.created_at', 'DESC');

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.search) {
      qb.andWhere(
        '(user.full_name ILIKE :search OR user.email ILIKE :search OR log.action ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [logs, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Global Products Overview across all stores
   */
  async getProductsOverview(query: { search?: string; business_id?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.business', 'business')
      .orderBy('product.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('(product.name ILIKE :search OR product.sku ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.business_id) {
      qb.andWhere('product.business_id = :bId', { bId: query.business_id });
    }

    const [products, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.selling_price || p.mrp || 0,
        cost_price: p.cost_price || 0,
        current_stock: p.current_stock || 0,
        business_id: p.business_id,
        business_name: p.business?.name || 'N/A',
        category_id: p.category_id,
        created_at: p.created_at,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

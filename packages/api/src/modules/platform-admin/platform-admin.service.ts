import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
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
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
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
      relations: { business: true },
      order: { created_at: 'DESC' },
      take: 5,
    });

    const recentActivities = await this.activityLogRepo.find({
      relations: { user: true, business: true },
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
   * All stores associated with a user — not just their single current
   * "active workspace" (user.business_id). An owner can create/onboard
   * multiple businesses (see BusinessesService.onboard/findMine), so this
   * mirrors that: every Business row with owner_user_id = this user, plus
   * their active workspace if it's a business they don't own (covers staff
   * roles like salesman/cashier, which only ever have business_id, never
   * ownership).
   */
  async getStoresForUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ownedStores = await this.businessRepo.find({
      where: { owner_user_id: userId },
      order: { created_at: 'DESC' },
    });

    let activeStore: Business | null = null;
    if (user.business_id && !ownedStores.some((s) => s.id === user.business_id)) {
      activeStore = await this.businessRepo.findOne({ where: { id: user.business_id } });
    }

    const stores = activeStore ? [...ownedStores, activeStore] : ownedStores;

    return {
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      stores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        is_owner: s.owner_user_id === userId,
        is_active_workspace: s.id === user.business_id,
        created_at: s.created_at,
      })),
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
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: { business: true } });
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
  async getAllStores(query: { search?: string; category?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.businessRepo.createQueryBuilder('business').orderBy('business.created_at', 'DESC');

    if (query.category) {
      qb.andWhere(
        `(business.category ILIKE :cat OR business.name ILIKE :cat OR EXISTS (SELECT 1 FROM products p WHERE p.business_id = business.id AND p.category ILIKE :cat))`,
        { cat: `%${query.category}%` },
      );
    }

    if (query.search) {
      qb.andWhere(
        `(business.name ILIKE :search OR business.category ILIKE :search OR EXISTS (SELECT 1 FROM users u WHERE (u.business_id = business.id OR u.id = business.owner_user_id) AND (u.email ILIKE :search OR u.full_name ILIKE :search)))`,
        { search: `%${query.search}%` },
      );
    }

    const [stores, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Fetch counts and owner details for each store
    const storeData = await Promise.all(
      stores.map(async (store) => {
        const whereConditions: any[] = [{ business_id: store.id }];
        if (store.owner_user_id) {
          whereConditions.push({ id: store.owner_user_id });
        }

        const ownerUser = await this.userRepo
          .findOne({
            where: whereConditions,
            order: { created_at: 'ASC' },
          })
          .catch(() => null);

        const userCount = await this.userRepo.count({ where: { business_id: store.id } });
        const productCount = await this.productRepo.count({ where: { business_id: store.id } });
        const orderCount = await this.orderRepo.count({ where: { business_id: store.id } });

        return {
          ...store,
          owner_email: ownerUser?.email || 'N/A',
          owner_name: ownerUser?.full_name || 'N/A',
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
  async getProductsOverview(query: { search?: string; category?: string; business_id?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.business', 'business')
      .orderBy('product.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('(product.name ILIKE :search OR product.sku ILIKE :search OR product.category ILIKE :search OR business.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.category) {
      qb.andWhere('(business.category ILIKE :category OR product.category ILIKE :category)', {
        category: `%${query.category}%`,
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
        price: p.selling_price || 0,
        cost_price: p.purchase_price || 0,
        current_stock: p.stock_quantity || 0,
        business_id: p.business_id,
        business_name: p.business?.name || 'N/A',
        category: p.category,
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

  /**
   * System-wide Global Orders Stream & Telemetry
   */
  async getGlobalOrders(query: { search?: string; status?: string; business_id?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.business', 'business')
      .orderBy('order.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('(order.customer_name ILIKE :search OR order.order_number ILIKE :search OR business.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.status) {
      qb.andWhere('order.status ILIKE :status', { status: `%${query.status}%` });
    }

    if (query.business_id) {
      qb.andWhere('order.business_id = :bId', { bId: query.business_id });
    }

    const [orders, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Calculate total gross platform revenue
    const totalRevenueRaw = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.total_amount)', 'sum')
      .getRawOne();
    const totalRevenue = parseFloat(totalRevenueRaw?.sum || '0');

    return {
      data: orders.map((o) => ({
        id: o.id,
        order_number: o.order_number || o.id.slice(0, 8),
        customer_name: o.customer_name || 'Walk-in Customer',
        business_id: o.business_id,
        business_name: o.business?.name || 'N/A',
        status: o.status || 'completed',
        total_amount: Number(o.total_amount) || 0,
        tax_amount: Number(o.tax_amount) || 0,
        created_at: o.created_at,
      })),
      summary: {
        totalOrders: total,
        totalRevenue,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Real-time System Telemetry & DB Health Ping
   */
  async getSystemHealth() {
    const startPing = Date.now();
    await this.dataSource.query('SELECT 1');
    const dbLatencyMs = Date.now() - startPing;

    const memory = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    return {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      database: {
        status: 'CONNECTED',
        latencyMs: dbLatencyMs,
        engine: 'PostgreSQL',
      },
      system: {
        uptimeSeconds: Math.floor(uptimeSeconds),
        uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${Math.floor(uptimeSeconds % 60)}s`,
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: {
          heapUsedMb: (memory.heapUsed / 1024 / 1024).toFixed(2),
          heapTotalMb: (memory.heapTotal / 1024 / 1024).toFixed(2),
          rssMb: (memory.rss / 1024 / 1024).toFixed(2),
        },
      },
    };
  }

  private currentAnnouncement = {
    active: false,
    message: '',
    type: 'info',
    updated_at: new Date().toISOString(),
  };

  async getAnnouncement() {
    return this.currentAnnouncement;
  }

  async setAnnouncement(dto: { active: boolean; message: string; type?: string }) {
    this.currentAnnouncement = {
      active: dto.active,
      message: dto.message,
      type: dto.type || 'info',
      updated_at: new Date().toISOString(),
    };
    return this.currentAnnouncement;
  }

  /**
   * Super Admin Store Impersonation — 1-click developer login to any store
   */
  async impersonateStore(businessId: string) {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Store not found');
    }

    const whereConditions: any[] = [{ business_id: business.id }];
    if (business.owner_user_id) {
      whereConditions.push({ id: business.owner_user_id });
    }

    let ownerUser = await this.userRepo
      .findOne({
        where: whereConditions,
        order: { created_at: 'ASC' },
      })
      .catch(() => null);

    if (!ownerUser) {
      ownerUser = await this.userRepo.findOne({ where: { business_id: business.id } });
    }

    if (!ownerUser) {
      throw new NotFoundException('No owner user account found for this store');
    }

    const payload = {
      sub: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
      business_id: business.id,
    };

    const token = this.jwtService.sign(payload);

    await this.logActivity(
      'SUPER_ADMIN_IMPERSONATE_STORE',
      ownerUser.id,
      business.id,
      'stores',
      { store_name: business.name, owner_email: ownerUser.email },
    );

    return {
      access_token: token,
      user: {
        id: ownerUser.id,
        email: ownerUser.email,
        full_name: ownerUser.full_name,
        role: ownerUser.role,
        business_id: business.id,
        business_name: business.name,
      },
    };
  }

  /**
   * 1-Click Platform JSON Data Snapshot Export
   */
  async exportSystemSnapshot() {
    const [stores, users, products, orders, activityLogs] = await Promise.all([
      this.businessRepo.find({ take: 100 }),
      this.userRepo.find({ take: 100 }),
      this.productRepo.find({ take: 100 }),
      this.orderRepo.find({ take: 100 }),
      this.activityLogRepo.find({ take: 100, order: { created_at: 'DESC' } }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      counts: {
        stores: stores.length,
        users: users.length,
        products: products.length,
        orders: orders.length,
        activityLogs: activityLogs.length,
      },
      data: {
        stores,
        users: users.map((u) => {
          const { password_hash, password_reset_token, ...safeUser } = u as any;
          return safeUser;
        }),
        products,
        orders,
        activityLogs,
      },
    };
  }
}

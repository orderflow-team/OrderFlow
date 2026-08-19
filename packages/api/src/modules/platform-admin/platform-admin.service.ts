import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, DataSource, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Business, User, Product, Order, UserActivityLog, BusinessConnection, PlatformSetting } from '../../database/entities';
import { UserRole } from '../../common/enums/user-role.enum';
import { isValidGstin } from '../../common/utils/gst.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly notificationsService: NotificationsService,
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
    @InjectRepository(BusinessConnection)
    private readonly businessConnectionRepo: Repository<BusinessConnection>,
    @InjectRepository(PlatformSetting)
    private readonly platformSettingRepo: Repository<PlatformSetting>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  /** Lazily creates the single settings row on first read/write — see PlatformSetting's own comment for why this replaced an in-memory field. */
  private async getSettingsRow(): Promise<PlatformSetting> {
    const existing = await this.platformSettingRepo.find({ take: 1 });
    if (existing.length > 0) return existing[0];
    return this.platformSettingRepo.save(this.platformSettingRepo.create({}));
  }

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
      b2b_sync_enabled?: boolean;
      gst_number?: string;
    },
    adminUserId?: string,
  ) {
    const store = await this.businessRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }
    if (dto.gst_number && !isValidGstin(dto.gst_number)) {
      throw new BadRequestException('Invalid GSTIN — check the 15-character number and try again');
    }

    Object.assign(store, dto);
    const updated = await this.businessRepo.save(store);

    await this.logActivity('UPDATE_STORE', adminUserId, storeId, 'Business', { dto });

    return updated;
  }

  /**
   * Support/debug tool: fires a real push at a specific store's registered
   * devices on demand. Deliberately not exposed on the store owner's own
   * Settings page — a "does push actually work" check belongs with whoever
   * is diagnosing a delivery problem (platform admin), not in front of every
   * business owner as a button they have no reason to press day to day.
   */
  async sendTestPush(storeId: string, adminUserId?: string) {
    const store = await this.businessRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }
    const result = await this.notificationsService.sendTestPush(storeId);
    await this.logActivity('TEST_PUSH', adminUserId, storeId, 'Business', result);
    return result;
  }

  /**
   * Permanently delete a tenant business and everything scoped to it
   * (products, orders, customers, suppliers, staff accounts, etc).
   * Irreversible — used by platform admins to clean up test/dummy stores.
   *
   * Most business-scoped tables have no ON DELETE CASCADE back to
   * `businesses`, so child rows are removed in dependency order inside one
   * transaction rather than relying on the DB to cascade for us.
   */
  async deleteStore(storeId: string, adminUserId?: string) {
    const store = await this.businessRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    // UserRole.ADMIN is also the default role every normal store owner gets on
    // signup, so it can't be used to detect the platform admin's own dev-shell
    // business — key off the well-known bootstrap email instead (same check
    // the admin UI uses for "isDevAccount").
    if (store.owner_user_id) {
      const owner = await this.userRepo.findOne({ where: { id: store.owner_user_id } });
      if (owner?.email === 'admin@orderflow.com') {
        throw new BadRequestException('Cannot delete the platform admin\'s own business account');
      }
    }

    const storeName = store.name;

    await this.dataSource.transaction(async (manager) => {
      // Clear cross-business references that point INTO this business —
      // otherwise another tenant's row could block this delete.
      await manager.query(`UPDATE customers SET linked_business_id = NULL WHERE linked_business_id = $1`, [storeId]);
      await manager.query(`UPDATE suppliers SET linked_business_id = NULL WHERE linked_business_id = $1`, [storeId]);
      await manager.query(
        `UPDATE products SET last_supplier_id = NULL WHERE last_supplier_id IN (SELECT id FROM suppliers WHERE business_id = $1)`,
        [storeId],
      );
      await manager.query(
        `DELETE FROM business_connections WHERE retailer_business_id = $1 OR wholesaler_business_id = $1`,
        [storeId],
      );

      // Orders and everything billed/ticketed against them.
      await manager.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = $1)`, [storeId]);
      await manager.query(`DELETE FROM payments WHERE business_id = $1`, [storeId]);
      await manager.query(`UPDATE invoices SET reference_invoice_id = NULL WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = $1)`, [storeId]);
      await manager.query(`DELETE FROM invoices WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM kot WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM commissions WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM orders WHERE business_id = $1`, [storeId]);

      // Products and their purchase/scan history.
      await manager.query(`DELETE FROM invoice_scan_items WHERE scan_id IN (SELECT id FROM invoice_scans WHERE business_id = $1)`, [storeId]);
      await manager.query(`DELETE FROM invoice_scan_files WHERE scan_id IN (SELECT id FROM invoice_scans WHERE business_id = $1)`, [storeId]);
      await manager.query(`DELETE FROM invoice_scans WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM purchase_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE business_id = $1)`, [storeId]);
      await manager.query(`DELETE FROM purchase_orders WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM price_history WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM stocks WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM products WHERE business_id = $1`, [storeId]); // cascades product_variants, product_batches

      // Customers, suppliers, and the rest of the business-scoped tables.
      await manager.query(`DELETE FROM visits WHERE salesman_id IN (SELECT id FROM salesmen WHERE business_id = $1)`, [storeId]);
      await manager.query(`DELETE FROM ledgers WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM customers WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM suppliers WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM notifications WHERE business_id = $1`, [storeId]);
      await manager.query(`UPDATE categories SET parent_id = NULL WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM categories WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM tables WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM waiters WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM salesmen WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM expenses WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM attendances WHERE business_id = $1`, [storeId]);

      // Staff/owner accounts, then the business row itself. `users.business_id`
      // has no cascade back to `businesses`, so the business can't go first;
      // `businesses.owner_user_id` is cleared first since it blocks deleting
      // the owner's own user row while it's still set.
      await manager.query(`UPDATE businesses SET owner_user_id = NULL WHERE id = $1`, [storeId]);
      await manager.query(`DELETE FROM users WHERE business_id = $1`, [storeId]);
      await manager.query(`DELETE FROM businesses WHERE id = $1`, [storeId]);
    });

    await this.logActivity('DELETE_STORE', adminUserId, undefined, 'Business', { storeId, storeName });

    return { success: true, message: `Store "${storeName}" and all associated data permanently deleted.` };
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
        barcode: p.barcode,
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
  async getGlobalOrders(query: { search?: string; status?: string; business_id?: string; origin?: string; page?: number; limit?: number }) {
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

    if (query.origin) {
      qb.andWhere('order.origin = :origin', { origin: query.origin });
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
        origin: o.origin || 'manual',
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
   * Platform-wide view of every B2B account link (business-connections
   * module) — who's linked, who has a pending request, who got rejected.
   * Support has had no way to see this at all short of a direct DB query;
   * this is what a "my wholesaler's orders aren't syncing" ticket needs.
   */
  async getBusinessConnections(query: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.businessConnectionRepo
      .createQueryBuilder('conn')
      .leftJoinAndSelect('conn.retailer_business', 'retailer')
      .leftJoinAndSelect('conn.wholesaler_business', 'wholesaler')
      .orderBy('conn.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('conn.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(retailer.name ILIKE :search OR wholesaler.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: rows.map((c) => ({
        id: c.id,
        status: c.status,
        retailer_business_id: c.retailer_business_id,
        retailer_name: c.retailer_business?.name || 'N/A',
        wholesaler_business_id: c.wholesaler_business_id,
        wholesaler_name: c.wholesaler_business?.name || 'N/A',
        initiated_by_business_id: c.initiated_by_business_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
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

  /**
   * Users whose last_active_at (touched by JwtStrategy on every authenticated
   * request, throttled to once/minute) falls within the last 5 minutes —
   * the "live now" view. Not real logout-aware presence (a closed tab still
   * shows as active until its last touch ages out), just a recency window.
   */
  async getLiveUsers() {
    const users = await this.userRepo.find({
      where: { last_active_at: MoreThan(new Date(Date.now() - 5 * 60 * 1000)) },
      relations: { business: true },
      order: { last_active_at: 'DESC' },
    });

    return users.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      business_name: u.business?.name || 'N/A',
      last_active_at: u.last_active_at,
    }));
  }

  async getAnnouncement() {
    const settings = await this.getSettingsRow();
    return {
      active: settings.announcement_active,
      message: settings.announcement_message ?? '',
      type: settings.announcement_type,
      updated_at: settings.updated_at,
    };
  }

  async setAnnouncement(dto: { active: boolean; message: string; type?: string }) {
    const settings = await this.getSettingsRow();
    settings.announcement_active = dto.active;
    settings.announcement_message = dto.message;
    settings.announcement_type = dto.type || 'info';
    const saved = await this.platformSettingRepo.save(settings);
    return {
      active: saved.announcement_active,
      message: saved.announcement_message ?? '',
      type: saved.announcement_type,
      updated_at: saved.updated_at,
    };
  }

  /** Read by every logged-in user's app-shell (open to any role, see controller) so the login page / in-app banner can show it. */
  async getMaintenanceStatus() {
    const settings = await this.getSettingsRow();
    return {
      active: settings.maintenance_mode,
      message: settings.maintenance_message ?? '',
    };
  }

  async setMaintenanceMode(dto: { active: boolean; message?: string }) {
    const settings = await this.getSettingsRow();
    settings.maintenance_mode = dto.active;
    if (dto.message !== undefined) {
      settings.maintenance_message = dto.message;
    }
    const saved = await this.platformSettingRepo.save(settings);
    return {
      active: saved.maintenance_mode,
      message: saved.maintenance_message ?? '',
    };
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

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { Category } from '../../database/entities/category.entity';
import { Waiter } from '../../database/entities/waiter.entity';
import { Notification } from '../../database/entities/notification.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { DevToolsService } from '../dev-tools/dev-tools.service';
import { uploadsFilePathFromUrl } from '../../common/utils/public-url.util';

/** Best-effort cleanup of a previously uploaded logo so replacing/removing it doesn't leak files under uploads/logos. */
function deleteLogoFile(logoUrl: string | null | undefined) {
  if (!logoUrl || !logoUrl.includes('/uploads/logos/')) return;
  fs.unlink(uploadsFilePathFromUrl(logoUrl), () => {});
}

/** Best-effort cleanup of a previously uploaded UPI QR image so replacing/removing it doesn't leak files under uploads/upi-qr. */
function deleteUpiQrFile(upiQrUrl: string | null | undefined) {
  if (!upiQrUrl || !upiQrUrl.includes('/uploads/upi-qr/')) return;
  fs.unlink(uploadsFilePathFromUrl(upiQrUrl), () => {});
}

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    private devToolsService: DevToolsService,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateBusinessDto, ownerUserId?: string) {
    const business = this.businessesRepository.create({
      owner_user_id: ownerUserId,
      name: dto.name,
      category: dto.category,
      gst_number: dto.gstNumber,
      drug_license_number_1: dto.drugLicenseNumber1,
      drug_license_number_2: dto.drugLicenseNumber2,
      phone: dto.phone,
      address: dto.address,
      currency: dto.currency ?? 'INR',
      timezone: dto.timezone ?? 'Asia/Kolkata',
      logo_url: dto.logoUrl,
      inventory_enabled: dto.inventoryEnabled ?? true,
      ai_chat_enabled: dto.aiChatEnabled ?? true,
      allow_orders_beyond_stock: dto.allowOrdersBeyondStock ?? true,
      b2b_sync_enabled: dto.b2bSyncEnabled ?? true,
      custom_settings: dto.customSettings ?? null,
    });
    return this.businessesRepository.save(business);
  }

  /**
   * Onboarding step: create a business owned by this user (one of potentially
   * several, e.g. a user running shops in multiple categories) and make it
   * their active workspace.
   */
  async onboard(userId: string, dto: CreateBusinessDto) {
    const business = await this.create(dto, userId);
    await this.usersRepository.update({ id: userId }, { business_id: business.id });
    return business;
  }

  /** Lists every business this user owns, for the post-login workspace picker. */
  async findMine(userId: string) {
    // Businesses created before multi-business support has owner_user_id
    // unset. The user's current active workspace is unambiguously theirs, so
    // backfill ownership the first time they hit the picker.
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (user?.business_id) {
      await this.businessesRepository.update(
        { id: user.business_id, owner_user_id: IsNull() },
        { owner_user_id: userId },
      );
    }

    return this.businessesRepository.find({
      where: { owner_user_id: userId },
      order: { created_at: 'ASC' },
    });
  }

  /** Switches the user's active workspace to one of their own businesses. */
  async selectActive(userId: string, businessId: string) {
    const business = await this.findOneOrFail(businessId);
    if (business.owner_user_id !== userId) {
      throw new NotFoundException('Business not found');
    }
    await this.usersRepository.update({ id: userId }, { business_id: business.id });
    return business;
  }

  /**
   * A caller may view a business if it's their currently-active workspace
   * (covers staff logins like salesman/kitchen_staff, which have a
   * business_id but no ownership) or one they own outright.
   */
  async findOne(id: string, requestingUserId: string, requestingUserBusinessId?: string) {
    const business = await this.findOneOrFail(id);
    if (business.owner_user_id !== requestingUserId && business.id !== requestingUserBusinessId) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async update(id: string, dto: UpdateBusinessDto, requestingUserId: string) {
    const business = await this.findOneOrFail(id);
    if (business.owner_user_id !== requestingUserId) {
      throw new ForbiddenException('You do not have permission to edit this business');
    }
    Object.assign(business, {
      name: dto.name ?? business.name,
      category: dto.category ?? business.category,
      gst_number: dto.gstNumber ?? business.gst_number,
      drug_license_number_1: dto.drugLicenseNumber1 ?? business.drug_license_number_1,
      drug_license_number_2: dto.drugLicenseNumber2 ?? business.drug_license_number_2,
      phone: dto.phone ?? business.phone,
      address: dto.address ?? business.address,
      currency: dto.currency ?? business.currency,
      timezone: dto.timezone ?? business.timezone,
      logo_url: dto.logoUrl ?? business.logo_url,
      inventory_enabled: dto.inventoryEnabled ?? business.inventory_enabled,
      ai_chat_enabled: dto.aiChatEnabled ?? business.ai_chat_enabled,
      allow_orders_beyond_stock: dto.allowOrdersBeyondStock ?? business.allow_orders_beyond_stock,
      b2b_sync_enabled: dto.b2bSyncEnabled ?? business.b2b_sync_enabled,
      custom_settings: dto.customSettings ?? business.custom_settings,
    });
    return this.businessesRepository.save(business);
  }

  async updateLogo(id: string, logoUrl: string, requestingUserId: string) {
    const business = await this.findOneOrFail(id);
    if (business.owner_user_id !== requestingUserId) {
      throw new ForbiddenException('You do not have permission to edit this business');
    }
    const previousLogoUrl = business.logo_url;
    business.logo_url = logoUrl;
    const saved = await this.businessesRepository.save(business);
    if (previousLogoUrl !== logoUrl) {
      deleteLogoFile(previousLogoUrl);
    }
    return saved;
  }

  async removeLogo(id: string, requestingUserId: string) {
    const business = await this.findOneOrFail(id);
    if (business.owner_user_id !== requestingUserId) {
      throw new ForbiddenException('You do not have permission to edit this business');
    }
    const previousLogoUrl = business.logo_url;
    business.logo_url = null as any;
    const saved = await this.businessesRepository.save(business);
    deleteLogoFile(previousLogoUrl);
    return saved;
  }

  async updateUpiQr(id: string, upiQrUrl: string, requestingUserId: string) {
    const business = await this.findOneOrFail(id);
    if (business.owner_user_id !== requestingUserId) {
      throw new ForbiddenException('You do not have permission to edit this business');
    }
    const previousUpiQrUrl = business.upi_qr_url;
    business.upi_qr_url = upiQrUrl;
    const saved = await this.businessesRepository.save(business);
    if (previousUpiQrUrl !== upiQrUrl) {
      deleteUpiQrFile(previousUpiQrUrl);
    }
    return saved;
  }

  async removeUpiQr(id: string, requestingUserId: string) {
    const business = await this.findOneOrFail(id);
    if (business.owner_user_id !== requestingUserId) {
      throw new ForbiddenException('You do not have permission to edit this business');
    }
    const previousUpiQrUrl = business.upi_qr_url;
    business.upi_qr_url = null as any;
    const saved = await this.businessesRepository.save(business);
    deleteUpiQrFile(previousUpiQrUrl);
    return saved;
  }

  /**
   * Permanently deletes this business and everything tied to it — products,
   * orders, customers, staff logins, the lot. Owner-only, and the caller
   * must supply the business's exact current name — checked here too
   * (not just client-side) since this is irreversible.
   */
  async deleteAccount(id: string, requestingUserId: string, confirmName: string) {
    const business = await this.findOneOrFail(id);
    if (business.owner_user_id !== requestingUserId) {
      throw new ForbiddenException('Only the business owner can delete this account');
    }
    if (!confirmName || confirmName !== business.name) {
      throw new BadRequestException('Business name confirmation does not match');
    }

    await this.dataSource.transaction(async (manager) => {
      // 1. Clear cross-business links pointing INTO this business
      await manager.query(`UPDATE customers SET linked_business_id = NULL WHERE linked_business_id = $1`, [id]);
      await manager.query(`UPDATE suppliers SET linked_business_id = NULL WHERE linked_business_id = $1`, [id]);
      await manager.query(
        `UPDATE products SET last_supplier_id = NULL WHERE last_supplier_id IN (SELECT id FROM suppliers WHERE business_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM business_connections WHERE retailer_business_id = $1 OR wholesaler_business_id = $1`,
        [id],
      );

      // 2. Orders, billing, KOT, and commissions
      await manager.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = $1)`, [id]);
      await manager.query(`DELETE FROM payments WHERE business_id = $1`, [id]);
      await manager.query(`UPDATE invoices SET reference_invoice_id = NULL WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = $1)`, [id]);
      await manager.query(`DELETE FROM invoices WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM kot WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM commissions WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM orders WHERE business_id = $1`, [id]);

      // 3. Products, variants, batches, scans, and purchase orders
      await manager.query(`DELETE FROM invoice_scan_items WHERE scan_id IN (SELECT id FROM invoice_scans WHERE business_id = $1)`, [id]);
      await manager.query(`DELETE FROM invoice_scan_files WHERE scan_id IN (SELECT id FROM invoice_scans WHERE business_id = $1)`, [id]);
      await manager.query(`DELETE FROM invoice_scans WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM purchase_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE business_id = $1)`, [id]);
      await manager.query(`DELETE FROM purchase_orders WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM supplier_returns WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM price_history WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM stocks WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM product_batches WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM product_variants WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM products WHERE business_id = $1`, [id]);

      // 4. CRM, operations, staff entities, and activity logs
      await manager.query(`DELETE FROM visits WHERE salesman_id IN (SELECT id FROM salesmen WHERE business_id = $1)`, [id]);
      await manager.query(`DELETE FROM ledgers WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM customers WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM suppliers WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM notifications WHERE business_id = $1`, [id]);
      await manager.query(`UPDATE categories SET parent_id = NULL WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM categories WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM tables WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM waiters WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM salesmen WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM expenses WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM attendances WHERE business_id = $1`, [id]);
      await manager.query(`DELETE FROM user_activity_logs WHERE business_id = $1`, [id]);

      // 5. Unlink owner_user_id to prevent FK constraint failure when deleting user(s)
      await manager.query(`UPDATE businesses SET owner_user_id = NULL WHERE id = $1`, [id]);

      // 6. Delete staff users belonging to this business (other than the owner)
      await manager.query(`DELETE FROM users WHERE business_id = $1 AND id != $2`, [id, requestingUserId]);

      // 7. Check if owner has other businesses
      const otherBusinesses = await manager.query(
        `SELECT id FROM businesses WHERE owner_user_id = $1 AND id != $2`,
        [requestingUserId, id],
      );

      if (otherBusinesses && otherBusinesses.length > 0) {
        // Owner has other businesses — switch owner's active business_id to one of them
        await manager.query(`UPDATE users SET business_id = $1 WHERE id = $2`, [otherBusinesses[0].id, requestingUserId]);
      } else {
        // Owner has no remaining businesses — delete the owner's user account
        await manager.query(`DELETE FROM users WHERE id = $1`, [requestingUserId]);
      }

      // 8. Delete the business record itself
      await manager.query(`DELETE FROM businesses WHERE id = $1`, [id]);
    });

    return { message: `"${business.name}" and all associated data have been permanently deleted.` };
  }

  private async findOneOrFail(id: string) {
    const business = await this.businessesRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }
}

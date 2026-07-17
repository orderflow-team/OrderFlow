import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

/** Best-effort cleanup of a previously uploaded logo so replacing/removing it doesn't leak files under uploads/logos. */
function deleteLogoFile(logoUrl: string | null | undefined) {
  if (!logoUrl || !logoUrl.startsWith('/uploads/logos/')) return;
  const filePath = path.join(process.cwd(), logoUrl);
  fs.unlink(filePath, () => {});
}

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
    @InjectRepository(User) private usersRepository: Repository<User>,
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

  private async findOneOrFail(id: string) {
    const business = await this.businessesRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

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
      phone: dto.phone,
      address: dto.address,
      currency: dto.currency ?? 'INR',
      timezone: dto.timezone ?? 'Asia/Kolkata',
      logo_url: dto.logoUrl,
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
  findMine(userId: string) {
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

  findOne(id: string) {
    return this.findOneOrFail(id);
  }

  async update(id: string, dto: UpdateBusinessDto) {
    const business = await this.findOneOrFail(id);
    Object.assign(business, {
      name: dto.name ?? business.name,
      category: dto.category ?? business.category,
      gst_number: dto.gstNumber ?? business.gst_number,
      phone: dto.phone ?? business.phone,
      address: dto.address ?? business.address,
      currency: dto.currency ?? business.currency,
      timezone: dto.timezone ?? business.timezone,
      logo_url: dto.logoUrl ?? business.logo_url,
    });
    return this.businessesRepository.save(business);
  }

  private async findOneOrFail(id: string) {
    const business = await this.businessesRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }
}

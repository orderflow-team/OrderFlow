import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../database/entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  create(dto: CreateCategoryDto) {
    const category = this.categoriesRepository.create({
      business_id: dto.businessId,
      name: dto.name,
      parent_id: dto.parentId,
    });
    return this.categoriesRepository.save(category);
  }

  findAll(businessId: string) {
    return this.categoriesRepository
      .createQueryBuilder('category')
      .where('category.business_id = :businessId', { businessId })
      .orderBy('category.created_at', 'ASC')
      .getMany();
  }

  async findOne(id: string, businessId: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(id: string, businessId: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id, businessId);
    const oldName = category.name;
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.parentId !== undefined) category.parent_id = dto.parentId;
    const saved = await this.categoriesRepository.save(category);

    if (dto.name !== undefined && oldName !== dto.name) {
      await this.categoriesRepository.manager
        .createQueryBuilder()
        .update('products')
        .set({ category: dto.name })
        .where('business_id = :businessId AND category = :oldName', {
          businessId,
          oldName,
        })
        .execute();
    }
    return saved;
  }

  async remove(id: string, businessId: string) {
    const category = await this.findOne(id, businessId);
    await this.categoriesRepository.remove(category);
    return { deleted: true };
  }
}

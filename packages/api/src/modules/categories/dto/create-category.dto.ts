import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @IsUUID()
  businessId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

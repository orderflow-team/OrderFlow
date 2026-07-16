import { IsUUID } from 'class-validator';

export class MergeProductsDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  keepProductId: string;

  @IsUUID()
  removeProductId: string;
}

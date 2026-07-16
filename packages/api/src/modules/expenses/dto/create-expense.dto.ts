import { IsString, IsOptional, IsUUID, IsNumber, Min, IsDateString } from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;
}

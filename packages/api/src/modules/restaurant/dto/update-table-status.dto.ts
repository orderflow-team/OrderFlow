import { IsIn } from 'class-validator';

export const TABLE_STATUSES = ['available', 'occupied', 'payment_pending'] as const;

export class UpdateTableStatusDto {
  @IsIn(TABLE_STATUSES)
  status: (typeof TABLE_STATUSES)[number];
}

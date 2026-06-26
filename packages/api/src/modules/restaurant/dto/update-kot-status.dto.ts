import { IsIn } from 'class-validator';

export const KOT_STATUSES = ['pending', 'preparing', 'ready', 'served'] as const;

export class UpdateKotStatusDto {
  @IsIn(KOT_STATUSES)
  status: (typeof KOT_STATUSES)[number];
}

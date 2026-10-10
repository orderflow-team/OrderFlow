import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { SheetsSyncKeyGuard } from './sheets-sync.guard';

// Read-only feed for the admin's Google Sheet (Apps Script pulls on a timer).
// Auth is the static SHEETS_SYNC_KEY header, not a user JWT.
@UseGuards(SheetsSyncKeyGuard)
@Controller('api/sheets-sync')
export class SheetsSyncController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('order-lines')
  getOrderLines(@Query('cursor') cursor?: string, @Query('limit') limit?: number) {
    return this.platformAdminService.getSheetSyncBatch(cursor, limit);
  }
}

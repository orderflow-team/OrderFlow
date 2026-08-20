import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(private dataSource: DataSource) {}

  // Unauthenticated by design — this is the target for external uptime
  // pingers keeping the Render free-tier instance and Neon's free-tier
  // compute from idling out. The `SELECT 1` is what actually keeps Neon
  // warm; a ping that only hit the API layer would still let the DB
  // autosuspend after 5 minutes independently of Render's own spin-down.
  @Get('health')
  async health() {
    const startPing = Date.now();
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', timestamp: new Date(), dbLatencyMs: Date.now() - startPing };
  }
}

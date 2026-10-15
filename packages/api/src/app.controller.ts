import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(private dataSource: DataSource) {}

  // Unauthenticated by design: the target for uptime monitors (see
  // .github/workflows/keep-alive.yml). The `SELECT 1` proves the database is
  // reachable, not just the API process, and keeps a serverless database from
  // idling out.
  //
  // Served at two paths on purpose. The reverse proxy only forwards `/api/*`
  // and `/auth/*` to this service, so a public monitor can only reach
  // `/api/health`. The bare `/health` stays for direct and local checks.
  @Get(['health', 'api/health'])
  async health() {
    const startPing = Date.now();
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', timestamp: new Date(), dbLatencyMs: Date.now() - startPing };
  }
}

import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

/** How long a database check is reused. Bounds database load from this public route to one query per window, whatever the request rate. */
export const HEALTH_CACHE_MS = 5_000;
/** A hung database must fail the check, not hang the monitor's request. */
export const HEALTH_TIMEOUT_MS = 5_000;

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  private probe: { at: number; result: Promise<void> } | null = null;

  constructor(private dataSource: DataSource) {}

  // Unauthenticated by design: the target for uptime monitors (see
  // .github/workflows/keep-alive.yml). The `SELECT 1` proves the database is
  // reachable, not just the API process, and keeps a serverless database from
  // idling out.
  //
  // Because anyone can call it, it is deliberately cheap and quiet: a per-IP
  // limit well below the global one, a shared result for HEALTH_CACHE_MS so
  // traffic cannot turn into database load, and a body that says only ok or
  // unavailable (timings and error text stay in the server log; the platform
  // admin health page has the detail).
  //
  // Served at two paths on purpose. The reverse proxy only forwards `/api/*`
  // and `/auth/*` to this service, so a public monitor can only reach
  // `/api/health`. The bare `/health` stays for direct and local checks.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(['health', 'api/health'])
  async health() {
    try {
      await this.checkDatabase();
    } catch (error: any) {
      this.logger.error(`Health check failed: ${error?.message ?? error}`);
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
    return { status: 'ok', timestamp: new Date() };
  }

  /** One shared in-flight/recent probe, so concurrent and repeated requests reuse a single query. */
  private checkDatabase(): Promise<void> {
    const now = Date.now();
    if (this.probe && now - this.probe.at < HEALTH_CACHE_MS) return this.probe.result;

    let timer: NodeJS.Timeout;
    const result = Promise.race([
      this.dataSource.query('SELECT 1').then(() => undefined),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`database did not answer within ${HEALTH_TIMEOUT_MS}ms`)), HEALTH_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timer));
    this.probe = { at: now, result };
    return result;
  }
}

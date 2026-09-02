import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import * as path from "path";
import * as entities from "./entities";

// DATABASE_URL is only ever set for managed Postgres (Render/Neon) — local
// dev always falls back to the docker-compose DB below. Treated here as the
// single signal for "this is production."
const isManagedPostgres = !!process.env.DATABASE_URL;

export function getConnectionOptions() {
  return isManagedPostgres
    ? {
        url: process.env.DATABASE_URL,
        // DATABASE_URL is only ever set for managed Postgres (Render etc.), which requires SSL
        // for external connections regardless of NODE_ENV — the local docker-compose DB uses
        // the DB_HOST branch below instead and never hits this. rejectUnauthorized: true
        // verified working against the real production Neon endpoint before this change —
        // Neon uses a publicly-trusted CA-signed cert, so there's nothing to add (no custom CA
        // bundle needed); false accepted ANY certificate, including a MITM'd one.
        ssl: { rejectUnauthorized: true },
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USER || "orderflow_user",
        password: process.env.DB_PASSWORD || "password123",
        database: process.env.DB_NAME || "orderflow_dev",
      };
}

export const databaseConfig: TypeOrmModuleOptions = {
  type: "postgres",
  ...getConnectionOptions(),
  entities: Object.values(entities) as any[],
  migrations: [path.join(__dirname, "migrations/*{.ts,.js}")],
  // Every environment uses the same versioned migration history. Automatic
  // synchronization can silently alter a developer database differently from
  // production and leaves raw SQL tables (such as subscriptions) unmanaged.
  synchronize: false,
  // Migrations are deliberately run by the deployment job (`npm run
  // migration:run --workspace=api`) before API replicas start. Running them
  // here would let every replica attempt schema writes during scale-out.
  migrationsRun: false,
  logging: true,
  dropSchema: false, // Prevents DB from wiping on every file save
};

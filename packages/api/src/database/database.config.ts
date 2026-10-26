import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import * as path from "path";
import * as dotenv from "dotenv";
import * as entities from "./entities";

// Preload environment variables from .env.local / .env before database config resolution
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local") });
dotenv.config();

const isManagedPostgres = !!process.env.DATABASE_URL;
// A self-hosted Postgres (DB_HOST/DB_PASSWORD, no DATABASE_URL) in production must behave like a managed one:
// no schema auto-sync and no query logging (which prints OTP codes and password hashes).
const isDevelopmentDatabase = !isManagedPostgres && process.env.NODE_ENV !== "production";

// The local-development fallback below ships a well-known password. Outside
// development, refuse to start with it rather than quietly connecting (or
// failing open) with a credential that is public in the repository.
if (
  !isManagedPostgres &&
  process.env.NODE_ENV === "production" &&
  !process.env.DB_PASSWORD
) {
  throw new Error(
    "DATABASE_URL (or DB_PASSWORD) must be set in production; the built-in development database password is not allowed.",
  );
}

export function getConnectionOptions() {
  return isManagedPostgres
    ? {
      url: process.env.DATABASE_URL,
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
  synchronize: isDevelopmentDatabase,
  // No deploy step runs `npm run migration:run` — the single API container
  // applies pending migrations itself on boot. If the API is ever scaled to
  // several replicas, move this into a one-off deploy job and set it to
  // false, or replicas will race each other on schema writes.
  migrationsRun: true,
  // Full query logging prints every parameter — OTP codes, password hashes,
  // staff passwords, customer phone numbers — into the server logs. Keep it
  // for local development only; DB_LOG_QUERIES=true turns it on elsewhere.
  logging: isDevelopmentDatabase || process.env.DB_LOG_QUERIES === "true" ? true : ["error", "warn", "migration"],
  dropSchema: false, // Prevents DB from wiping on every file save
};

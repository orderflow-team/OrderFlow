import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import * as path from "path";
import * as dotenv from "dotenv";
import * as entities from "./entities";

// Preload environment variables from .env.local / .env before database config resolution
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local") });
dotenv.config();

export function getConnectionOptions() {
  const isManagedPostgres = !!process.env.DATABASE_URL;
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
  synchronize: !isManagedPostgres,
  // Migrations are deliberately run by the deployment job (`npm run
  // migration:run --workspace=api`) before API replicas start. Running them
  // here would let every replica attempt schema writes during scale-out.
  migrationsRun: true,
  logging: true,
  dropSchema: false, // Prevents DB from wiping on every file save
};

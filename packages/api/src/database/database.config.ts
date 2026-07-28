import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as entities from './entities';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { 
        url: process.env.DATABASE_URL,
        // DATABASE_URL is only ever set for managed Postgres (Render etc.), which requires SSL
        // for external connections regardless of NODE_ENV — the local docker-compose DB uses
        // the DB_HOST branch below instead and never hits this.
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USER || 'orderflow_user',
        password: process.env.DB_PASSWORD || 'password123',
        database: process.env.DB_NAME || 'orderflow_dev',
      }),
  entities: Object.values(entities) as any[],
  synchronize: true, // Forces TypeORM to auto-create tables
  logging: true,
  dropSchema: false, // Prevents DB from wiping on every file save
};

import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as entities from './entities';
import { getConnectionOptions } from './database.config';

// Mirrors the envFilePath NestJS's ConfigModule loads in main.ts — this file
// runs standalone (via the TypeORM CLI, outside Nest's bootstrap), so it
// needs its own dotenv load to see the same DATABASE_URL. In production the
// file won't exist and dotenv silently no-ops, leaving real env vars intact.
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...getConnectionOptions(),
  entities: Object.values(entities) as any[],
  migrations: [path.join(__dirname, 'migrations/*.ts')],
  synchronize: false,
});

import { NestFactory } from '@nestjs/core';
import * as dns from 'dns';

// Force IPv4 globally before any other imports
dns.setDefaultResultOrder('ipv4first');

import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('');
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`✅ Application is running on: http://0.0.0.0:${port}`);
  console.log(`🚀 Complete Platform Super Admin Suite & Auto-SuperAdmin Seeding active at /api/platform-admin`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});

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

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With',
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('');
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    // APK release files keep a random on-disk name (see app-apk-releases.controller.ts)
    // to avoid collisions — this makes the browser save the download as "OBIX.apk" instead.
    setHeaders: (res, filePath) => {
      if (path.basename(path.dirname(filePath)) === 'app-apk-releases') {
        res.setHeader('Content-Disposition', 'attachment; filename="OBIX.apk"');
      }
    },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`✅ Application is running on: http://0.0.0.0:${port}`);
  console.log(`🚀 Complete Secure Platform Super Admin Suite active at /api/platform-admin`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});

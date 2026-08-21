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
  // Needed for PdfService's onModuleDestroy to actually run on SIGTERM
  // (Render sends this on every redeploy/restart) — without this, Nest
  // doesn't call lifecycle destroy hooks on process signals, and the shared
  // Puppeteer browser (see pdf.service.ts) would leak as an orphaned process.
  app.enableShutdownHooks();

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With',
    // Browsers hide all response headers from JS by default except a small
    // "safe" set — X-Total-Count (see orders.controller.ts's paginated
    // findAll) needs to be explicitly opted in or it's just invisible.
    exposedHeaders: 'X-Total-Count',
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

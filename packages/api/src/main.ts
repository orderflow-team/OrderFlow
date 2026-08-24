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

  // origin: true (reflect ANY origin back) + credentials: true is exactly
  // the pattern that lets any website make authenticated requests using a
  // visitor's own stored session — the browser attaches cookies/auth based
  // on credentials mode, not on whether the reflected origin looks
  // legitimate. In production this needs to be a real allowlist instead.
  //
  // Vercel gives this project no fixed custom domain — every deploy gets a
  // new random per-deployment URL, PLUS a few STABLE aliases that always
  // point at the current production deployment (`vercel alias ls`); those
  // stable ones are what real traffic uses. The Capacitor Android app's
  // WebView always presents as "https://localhost" (capacitor.config.ts
  // doesn't override server.hostname/androidScheme, so this is Capacitor's
  // documented default, not something specific to this app). ALLOWED_ORIGINS
  // lets this list grow later (e.g. a real custom domain) via an env var
  // alone, without a code change/redeploy, while defaulting to exactly
  // what's actually in use today.
  const DEFAULT_ALLOWED_ORIGINS = [
    'https://orderflow-web-git-main-clever-minds1.vercel.app',
    'https://orderflow-web-clever-minds1.vercel.app',
    'https://orderflow-web-iota.vercel.app',
    'https://localhost',
  ];
  // Same "is this production" signal database.config.ts already uses —
  // local dev (no DATABASE_URL) has no real user data at risk, so it stays
  // fully permissive rather than needing every developer's local origin
  // added to an allowlist.
  const isManagedPostgres = !!process.env.DATABASE_URL;
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;

  app.enableCors({
    origin: isManagedPostgres
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // No Origin header at all (server-to-server calls, curl, the OTA
          // updater's plain fetch) never carries a browser's ambient
          // credentials, so there's nothing for a real CORS check to protect
          // against here — always allowed.
          if (!origin || allowedOrigins.includes(origin)) callback(null, true);
          else callback(new Error(`CORS: origin "${origin}" not allowed`));
        }
      : true,
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

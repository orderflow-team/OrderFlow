import { NestFactory } from "@nestjs/core";
import * as dns from "dns";

// Force IPv4 globally before any other imports
dns.setDefaultResultOrder("ipv4first");

import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import * as path from "path";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Trust reverse proxy (Apache2 / Nginx) so client IP addresses from X-Forwarded-For
  // are used for rate-limiting rather than treating all traffic as 127.0.0.1
  app.set('trust proxy', true);
  // API responses are JSON/files rather than embeddable application pages.
  // These low-risk defaults prevent content-type sniffing, clickjacking, and
  // accidental referrer leakage without interfering with the web client.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
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
    "https://obix360.com",
    "https://www.obix360.com",
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:5173",
    "https://orderflow-web-git-main-clever-minds1.vercel.app",
    "https://orderflow-web-clever-minds1.vercel.app",
    "https://orderflow-web-iota.vercel.app",
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
  ];

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Server-to-server, mobile native calls without Origin header: allow
      if (!origin) return callback(null, true);

      // Mobile APK / Capacitor WebView origins: ALWAYS allow
      if (
        origin === "https://localhost" ||
        origin === "http://localhost" ||
        origin === "capacitor://localhost" ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("https://localhost:") ||
        origin.startsWith("capacitor://")
      ) {
        return callback(null, true);
      }

      // Check configured origins or default list
      if (allowedOrigins.includes(origin) || DEFAULT_ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      callback(null, false);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: "Content-Type,Accept,Authorization,X-Requested-With",
    exposedHeaders: "X-Total-Count",
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("");
  app.useStaticAssets(path.join(process.cwd(), "uploads"), {
    prefix: "/uploads",
    // APK release files keep a random on-disk name (see app-apk-releases.controller.ts)
    // to avoid collisions — this makes the browser save the download as "OBIX.apk" instead.
    setHeaders: (res, filePath) => {
      if (path.basename(path.dirname(filePath)) === "app-apk-releases") {
        res.setHeader("Content-Disposition", 'attachment; filename="OBIX.apk"');
      }
    },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, "0.0.0.0");

  console.log(`✅ Application is running on: http://0.0.0.0:${port}`);
  console.log(
    `🚀 Complete Secure Platform Super Admin Suite active at /api/platform-admin`,
  );
}

bootstrap().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});

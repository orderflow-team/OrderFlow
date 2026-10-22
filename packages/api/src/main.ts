import { NestFactory } from "@nestjs/core";
import * as dns from "dns";

// Force IPv4 globally before any other imports
dns.setDefaultResultOrder("ipv4first");

import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import * as path from "path";
import { json } from "express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { resolveListenPort } from "./common/utils/listen-port.util";
import { isOriginAllowed, parseAllowedOrigins } from "./common/utils/cors-origin.util";
import { assertCredentialKeyConfigured } from "./common/utils/credential-crypto.util";

async function bootstrap() {
  assertCredentialKeyConfigured();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Evolution API posts whole WhatsApp events (media thumbnails, contact cards,
  // long forwarded messages) to this route; Express's 100kb default rejects
  // those with 413, so the customer's order message is silently dropped. Parse
  // just this path with a bigger cap, before the default parser sees it. The
  // route is token-protected, and the default limit still covers everything else.
  app.use('/api/whatsapp/webhook', json({ limit: '10mb' }));
  // Nest only installs its own JSON parser when none named `jsonParser` is
  // already on the stack, and express.json() has exactly that name, so the
  // line above would otherwise switch JSON parsing off for every other route
  // (logins arrive with an empty body). Register the default parser ourselves.
  app.use(json());
  // Trust reverse proxy (Apache2 / Nginx) so client IP addresses from X-Forwarded-For
  // are used for rate-limiting rather than treating all traffic as 127.0.0.1.
  // Trust exactly the proxy hops in front of us, never `true`: `true` takes the
  // left-most X-Forwarded-For entry, which the client writes itself, so anyone
  // could send a fresh fake IP per request and skip every per-IP rate limit
  // (login, OTP, password reset). Set TRUST_PROXY_HOPS if there's more than
  // one proxy (e.g. a CDN in front of Nginx).
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
  app.set('trust proxy', Number.isFinite(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);
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
  // visitor's own stored session, so this is a real allowlist
  // (common/utils/cors-origin.util.ts). The Capacitor Android app's WebView
  // always presents as https://localhost (capacitor.config.ts doesn't override
  // server.hostname/androidScheme), so exactly those WebView origins are always
  // allowed; local dev servers are allowed only outside production.
  // ALLOWED_ORIGINS replaces the built-in list without a code change.
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const production = process.env.NODE_ENV === "production";

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => callback(null, isOriginAllowed(origin, { allowedOrigins, production })),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: "Content-Type,Accept,Authorization,X-Requested-With",
    exposedHeaders: "X-Total-Count",
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("");
  // Older builds cached invoice PDFs here, named by invoice number, so the
  // files are guessable and some hold another shop's invoice. PDFs now live
  // in storage/invoices (never served statically); refuse the old path so any
  // files still on disk can't be downloaded.
  app.use("/uploads/invoices", (_req, res) => {
    res.status(404).end();
  });
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

  const { port, usedDefault } = resolveListenPort();
  if (usedDefault) {
    console.warn(`⚠️ PORT is not set (or invalid); defaulting to ${port}. Set PORT explicitly so it matches your reverse proxy.`);
  }
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

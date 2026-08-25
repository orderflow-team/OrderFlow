import { defineConfig } from '@neon/config/v1';

// Object storage for files that must survive a Render redeploy (Render's disk is
// ephemeral). Publicly downloadable release binaries live in a public_read bucket
// so the download link stays stable without presigning.
export default defineConfig({
  preview: {
    buckets: {
      'app-releases': { access: 'public_read' },
      // public_read matches current behavior: both were served unauthenticated
      // via Express static /uploads, just on Render's disk instead of a bucket.
      'product-images': { access: 'public_read' },
      // Deprecated 2026-08-25 — this bucket was public_read, which exposed
      // supplier invoice scans (business-sensitive pricing/GST data) to
      // anyone who could guess a key. Neon's config tool can only CREATE
      // buckets, not change an existing one's access level, so it could never
      // be flipped to private in place — replaced by `invoice-scans-private`
      // below instead. InvoiceScanService.migrateLegacyBucket() copies any
      // remaining objects over on boot and deletes them from here; once that
      // drains to zero this entry can be deleted (bucket deletion isn't
      // supported by this config tool either — needs the Neon Console).
      'invoice-scans': { access: 'public_read' },
      // Private (default) — supplier invoice scans contain business-sensitive
      // pricing/GST/supplier data; every read goes through a short-lived
      // presigned URL (see InvoiceScanService.presignFileUrl), never a bare
      // public link.
      'invoice-scans-private': {},
      // OTA web-bundle zips for the Capacitor app (see app-updates module) — a
      // separate bucket from app-releases (APK binaries) despite both backing
      // "app releases," since they're unrelated artifact types.
      'ota-bundles': { access: 'public_read' },
      // Prescription photos captured at checkout — patient health information,
      // so unlike the buckets above this is private (default access): every
      // read goes through a short-lived presigned URL (see OrdersController's
      // prescription-url endpoint), never a bare public link.
      prescriptions: {},
      // Business logos and UPI QR codes, shown on invoices/PDFs — public_read
      // for the same reason as product-images/invoice-scans (unauthenticated
      // display, no presigning needed). Previously written to Render's
      // ephemeral disk (uploads/logos, uploads/upi-qr), which meant every
      // logo/QR broke on the next redeploy — see businesses.controller.ts.
      'business-branding': { access: 'public_read' },
    },
  },
});

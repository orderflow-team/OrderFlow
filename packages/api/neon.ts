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
      'invoice-scans': { access: 'public_read' },
    },
  },
});

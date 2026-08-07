import { defineConfig } from '@neon/config/v1';

// Object storage for files that must survive a Render redeploy (Render's disk is
// ephemeral). Publicly downloadable release binaries live in a public_read bucket
// so the download link stays stable without presigning.
export default defineConfig({
  preview: {
    buckets: {
      'app-releases': { access: 'public_read' },
    },
  },
});

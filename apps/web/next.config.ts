import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: no Next.js server at runtime. Required so this build can be
  // bundled into the Capacitor Android app; also serves the plain web deployment
  // as static files. All API calls go straight to NEXT_PUBLIC_API_URL (see
  // lib/api-client.ts) — there's no server here left to proxy through.
  output: 'export',
  // Custom export folder name — ONLY for local Capacitor builds (see
  // package.json's build:capacitor script). Vercel's Next.js framework
  // integration requires distDir to stay at its default (.next) so it can
  // find routes-manifest.json and handle the static export itself; pointing
  // it elsewhere breaks that deployment entirely. Locally on this machine,
  // though, the literal "out" folder name accumulated a Windows-level file
  // lock after repeated build/delete cycles, breaking every export build —
  // see export/utils.js's hasCustomExportOutput: with output:'export',
  // setting distDir renames the *export* output dir, not the build cache dir.
  ...(process.env.CAPACITOR_BUILD === '1' ? { distDir: 'app-export' } : {}),
  allowedDevOrigins: ['192.168.29.237'],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      '@react-three/drei',
      'three',
      '@base-ui/react',
      'zustand',
    ],
  },
};

export default nextConfig;

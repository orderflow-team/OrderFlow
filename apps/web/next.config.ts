import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: no Next.js server at runtime. Required so this build can be
  // bundled into the Capacitor Android app; also serves the plain web deployment
  // as static files. All API calls go straight to NEXT_PUBLIC_API_URL (see
  // lib/api-client.ts) — there's no server here left to proxy through.
  output: 'export',
  // Custom name (rather than the default "out") for the static export folder —
  // on this machine the literal "out" path accumulated a Windows-level file
  // lock after repeated build/delete cycles, breaking every subsequent export
  // build. See export/utils.js's hasCustomExportOutput: with output:'export',
  // setting distDir renames the *export* output dir, not the build cache dir.
  distDir: 'app-export',
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

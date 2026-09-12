import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // Static export: no Next.js server at runtime for production Capacitor builds
  ...(process.env.CAPACITOR_BUILD === '1' ? { output: 'export', distDir: 'app-export' } : {}),
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
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'orderflow-web-iota.vercel.app',
          },
        ],
        destination: 'https://obix360.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

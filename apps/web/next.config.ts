import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${apiTarget}/:path*`
      },
      {
        source: '/uploads/:path*',
        destination: `${apiTarget}/uploads/:path*`
      }
    ];
  }
};

export default nextConfig;

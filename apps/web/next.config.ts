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
  // The session token lives in localStorage, so anything that can run script on
  // the page can read it. These headers close the cheap routes in (framing,
  // content sniffing, referrer leaks, unused powerful features). The static
  // Capacitor export can't serve custom headers, so it's skipped there.
  ...(process.env.CAPACITOR_BUILD === '1'
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                // Voice orders use the microphone; nothing uses camera, location or payments.
                { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), payment=(), microphone=(self)' },
                // No includeSubDomains: that would force HTTPS on every *.obix360.com
                // host (staging, mail, a gateway) for a year in browsers that visited.
                ...(isDev
                  ? []
                  : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
              ],
            },
            // Logged-in app screens must never be indexed. robots.txt only stops
            // crawling; this header is what keeps a discovered URL out of results.
            {
              source:
                '/(admin|dashboard|billing|customers|inventory|orders|products|reports|restaurant|salesman|select-business|settings|staff|forgot-password|google-app-signin)/:path*',
              headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
            },
          ];
        },
      }),
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
      // One canonical host for search engines: www and apex both served 200,
      // splitting the site into two duplicate copies.
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.obix360.com',
          },
        ],
        destination: 'https://obix360.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

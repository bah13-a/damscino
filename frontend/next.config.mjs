/** @type {import('next').NextConfig} */
const apiUrl = process.env.API_URL || 'http://localhost:8080';

const nextConfig = {
  // standalone server for the Docker image; `next start` otherwise (e.g. Render Node runtime)
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // on Render's free plan a sleeping backend may need up to a minute to wake up
    proxyTimeout: 120_000,
  },
  // The browser only talks to this origin: /api/* is proxied to the API gateway (no CORS, one URL to share).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=(), payment=(), usb=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

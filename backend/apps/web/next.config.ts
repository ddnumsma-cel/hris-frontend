import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Use the repo-root .env so there is one env file for the whole monorepo.
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/**
 * The browser calls the API through this web server at /api/* (same address as the pages), so only
 * one address has to be reachable: on this PC, from another PC on the Wi-Fi, or through `pnpm share`.
 * API_INTERNAL_URL: where this server finds the API (default: NEXT_PUBLIC_API_URL if it is a full URL,
 * else http://127.0.0.1:API_PORT).
 */
const publicApi = process.env.NEXT_PUBLIC_API_URL ?? '';
const apiTarget = (
  process.env.API_INTERNAL_URL ??
  (/^https?:\/\//.test(publicApi) ? publicApi : `http://127.0.0.1:${process.env.API_PORT ?? 4000}`)
)
  .replace(/\/$/, '')
  // Node resolves "localhost" to IPv6 first, but the API listens on IPv4.
  .replace('//localhost', '//127.0.0.1');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Playwright run and `pnpm share` use their own build folders so they can run next to `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // The shared packages are prebuilt CommonJS; no transpilation needed.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiTarget}/:path*` }];
  },
  // Let the dev server be opened through a tunnel or from another PC on the same network.
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '*.ngrok-free.app',
    '*.ngrok.app',
    '192.168.*.*',
    '10.*.*.*',
    '172.*.*.*',
  ],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

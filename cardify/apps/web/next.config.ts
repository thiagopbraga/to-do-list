import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@cardify/shared'],
  async rewrites() {
    const api = process.env.API_URL ?? 'http://localhost:4000';
    return [{ source: '/v1/:path*', destination: `${api}/v1/:path*` }];
  },
};

export default config;

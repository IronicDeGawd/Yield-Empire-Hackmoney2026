import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'euc.li' },
      { protocol: 'https', hostname: 'metadata.ens.domains' },
    ],
  },
  async rewrites() {
    return [
      {
        // Proxy ENS avatar requests to bypass CORS
        source: '/api/ens-avatar/:path*',
        destination: 'https://euc.li/:path*',
      },
    ];
  },
};

export default nextConfig;

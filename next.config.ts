import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: '**',
      },
    ],
  },
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;

// next.config.js (FIXED FOR PDF.JS)

import type { NextConfig } from 'next';

const config: NextConfig = {
  eslint: {
    // Allow deployment with ESLint warnings/errors
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: [
    'pdf-parse',
    'sharp',
    'pdfjs-dist',       // resume parsing (src/lib/resume-source-text.ts) loads its worker from disk
    'mammoth',
  ],
  
  turbopack: {
    resolveAlias: {
      canvas: 'false',
      encoding: 'false',
    },
  },
  
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // Exclude problematic modules for browser builds
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    // For PDF.js compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        canvas: false, // Exclude canvas for browser
      };
    }
    
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },

  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdnjs.cloudflare.com',
      },
    ],
  },
};

export default config;
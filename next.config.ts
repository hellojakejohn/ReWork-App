import type { NextConfig } from 'next';

// Enforced on every response: no framing (clickjacking), no MIME sniffing, no full
// URLs in Referer. The full CSP below is report-only until we've watched the console
// for violations; frame-ancestors is enforced separately because browsers ignore it
// in a report-only policy.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://checkout.stripe.com https://billing.stripe.com",
  "frame-ancestors 'none'",
  'report-uri /api/csp-report',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const config: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  eslint: {
    // Lint errors fail the build. Warnings don't.
    ignoreDuringBuilds: false,
  },
  // The PDF fonts are read from disk at render time (src/lib/resume-pdf.tsx).
  outputFileTracingIncludes: {
    '/api/resumes/**/download': ['./src/lib/fonts/**'],
    // pdfjs (src/lib/resume-source-text.ts): its worker (belt and braces with the import
    // there) and @napi-rs/canvas, which it loads by a runtime require for DOMMatrix. Without
    // it pdf.mjs throws "DOMMatrix is not defined" on import. The glob picks up whichever
    // platform binary npm installed (linux-x64-gnu on Vercel).
    '/api/resumes/parse': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', './node_modules/@napi-rs/canvas*/**'],
  },
  serverExternalPackages: [
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
  },
};

export default config;
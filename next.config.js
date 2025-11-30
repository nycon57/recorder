// Common security headers shared across all routes
const COMMON_SECURITY_HEADERS = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=*, microphone=*, display-capture=*',
  },
];

// Content Security Policy with Clerk and Supabase support
const CSP_WITH_CLERK = {
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://unpkg.com/@ffmpeg/core@0.12.6/dist/ https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://*.clerk.com https://img.clerk.com https://storage.googleapis.com/eleven-public-cdn/",
    "media-src 'self' blob: data: https://*.supabase.co",
    "connect-src 'self' blob: https://*.supabase.co https://*.clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com https://*.upstash.io https://storage.googleapis.com/eleven-public-cdn/ https://unpkg.com/@ffmpeg/core@0.12.6/dist/ wss://*.supabase.co https://*.react-grab.com https://cdn.jsdelivr.net",
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),
};

// COOP/COEP headers required for SharedArrayBuffer (FFMPEG.wasm)
const COOP_COEP_HEADERS = [
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    key: 'Cross-Origin-Embedder-Policy',
    value: 'require-corp',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required headers for SharedArrayBuffer (FFMPEG.wasm support) + Security
  async headers() {
    return [
      // FFMPEG.wasm headers - ONLY for /record route
      // COOP/COEP are required for SharedArrayBuffer but break Clerk/Supabase embeds
      {
        source: '/record/:path*',
        headers: [
          ...COOP_COEP_HEADERS,
          ...COMMON_SECURITY_HEADERS,
          CSP_WITH_CLERK,
        ],
      },
      // Routes that require tailored headers to allow Supabase/Clerk assets
      // without enabling COOP/COEP (which would break third-party embeds)
      {
        source: '/library',
        headers: [...COMMON_SECURITY_HEADERS, CSP_WITH_CLERK],
      },
      {
        source: '/library/:path*',
        headers: [...COMMON_SECURITY_HEADERS, CSP_WITH_CLERK],
      },
      {
        source: '/(recordings|search|dashboard)/:path*',
        headers: [...COMMON_SECURITY_HEADERS, CSP_WITH_CLERK],
      },
      {
        source: '/((?!record|library|recordings|search|dashboard).*)',
        headers: [...COMMON_SECURITY_HEADERS, CSP_WITH_CLERK],
      },
    ];
  },

  // Enable React strict mode
  reactStrictMode: true,

  // TODO: Re-enable TypeScript build checks - https://github.com/[org]/recorder/issues/[TBD]
  // Current status: 1,249 type errors across multiple categories (as of 2025-10-19)
  // Priority order for incremental fixes:
  //   1. Next.js 15 async params migration (~50 errors in page components)
  //   2. Test suite type safety (Supabase mock typing ~100 errors)
  //   3. Worker handler coverage (missing job type handlers ~20 errors)
  //   4. Type mismatches in business logic (~200 errors)
  //   5. External library type definitions (~50 errors)
  // Target: Re-enable checks by end of Q1 2026 after incremental category fixes
  // Use `npm run type:check` to verify progress
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // PERF-FE-003: Enhanced image optimization
  images: {
    // Modern formats for better compression (60-70% bandwidth savings)
    formats: ['image/avif', 'image/webp'],
    // Common device breakpoints for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Smaller sizes for icons, thumbnails, avatars
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 1 year (static assets)
    minimumCacheTTL: 31536000,
    // Remote image domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        // Clerk user avatars
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: '**.clerk.accounts.dev',
      },
      {
        // Unsplash images for marketing pages
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Avatar placeholder service
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
    ],
  },

  // PERF: Externalize server-only packages from client bundle
  // These packages are used in /lib/services/ and /lib/workers/ (server-side only)
  // Excluding them from client bundle reduces initial load by 200+ MB
  // Note: Moved from experimental.serverComponentsExternalPackages (deprecated in Next.js 15)
  serverExternalPackages: [
    // ML/AI packages (69MB)
    '@xenova/transformers',
    'tesseract.js',
    'cohere-ai',

    // Document processing (57.5MB)
    'mammoth',
    'pdf-parse',
    'pdfjs-dist',

    // Media processing
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    'sharp',

    // Integration SDKs (194MB)
    'googleapis',
    '@notionhq/client',
    '@microsoft/microsoft-graph-client',
    'stripe',

    // Server utilities
    'archiver',
    'bcryptjs',
    'busboy',
  ],

  // Experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
      bodySizeLimit: '500mb', // Allow large video/audio file uploads
    },
  },

};

module.exports = nextConfig;

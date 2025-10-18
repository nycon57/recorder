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
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://*.clerk.com https://img.clerk.com",
    "media-src 'self' blob: data: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://*.clerk.com https://*.clerk.accounts.dev https://*.upstash.io wss://*.supabase.co",
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

  // Webpack configuration for workers
  webpack: (config, { isServer }) => {
    // Add fallbacks for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  // Enable React strict mode
  reactStrictMode: true,

  // Disable ESLint during builds (we'll fix errors separately)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  // Experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
      bodySizeLimit: '500mb', // Allow large video/audio file uploads
    },
  },
};

module.exports = nextConfig;

import type { Metadata } from 'next';
import Script from 'next/script';

import { Toaster } from '@/app/components/ui/sonner';
import { PostHogProvider } from '@/providers/posthog-provider';
import { QueryProvider } from '@/lib/providers/query-provider';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';

// Force dynamic rendering to prevent static generation at build time
// Root layout uses runtime env vars
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  title: 'Tribora — Stop answering the same question forty times.',
  description:
    'Your senior team already knows the answer. Tribora captures it once, in a ninety-second screen share — then gives every new hire an always-on tutor trained on your playbook, not the internet.',
  keywords: 'support training, onboarding, screen recording, internal tutor, knowledge base, employee enablement',
  authors: [{ name: 'Tribora' }],
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Tribora — Stop answering the same question forty times.',
    description:
      'Capture how your team actually does the work in a ninety-second screen share. Every new hire gets an always-on tutor trained on your playbook, not the internet.',
    type: 'website',
    url: 'https://tribora.com',
    images: [
      {
        url: '/screenshot-02.jpg',
        width: 1200,
        height: 630,
        alt: 'Tribora — an always-on tutor trained on your team.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tribora — Stop answering the same question forty times.',
    description:
      'Capture how your team actually does the work in a ninety-second screen share. Every new hire gets an always-on tutor trained on your playbook, not the internet.',
    images: ['/screenshot-02.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App UI fonts: Outfit (headings) + Inter (body) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Tribora brand fonts: Space Grotesk (display) + Manrope (body) + JetBrains Mono (mono) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="https://cdn.jsdelivr.net/npm/react-grab@latest/dist/index.js"
            strategy="afterInteractive"
            type="module"
          />
        )}
      </head>
      <body className="bg-background text-foreground antialiased">
        <QueryProvider>
          <PostHogProvider>
            {children}
            <Toaster />
            <Analytics />
          </PostHogProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

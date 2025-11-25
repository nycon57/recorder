import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import Script from 'next/script';

import { Toaster } from '@/app/components/ui/sonner';
import { ClerkProviderWrapper } from '@/app/components/providers/clerk-provider-wrapper';
import { QueryProvider } from '@/lib/providers/query-provider';

import './globals.css';

// Force dynamic rendering to prevent static generation at build time
// Root layout uses ClerkProvider which requires runtime env vars
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  title: 'Tribora - Illuminate Your Team\'s Knowledge',
  description:
    'The Knowledge Intelligence Layer — capture tacit expertise through screen recordings and transform it into structured, searchable documentation.',
  keywords: 'knowledge management, screen recording, transcription, AI documentation, tacit knowledge, workflow extraction',
  authors: [{ name: 'Tribora Team' }],
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Tribora - Illuminate Your Team\'s Knowledge',
    description:
      'The Knowledge Intelligence Layer — capture tacit expertise through screen recordings and transform it into structured, searchable documentation.',
    type: 'website',
    url: 'https://tribora.com',
    images: [
      {
        url: '/screenshot-02.jpg',
        width: 1200,
        height: 630,
        alt: 'Tribora - Knowledge Intelligence Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tribora - Illuminate Your Team\'s Knowledge',
    description:
      'The Knowledge Intelligence Layer — capture tacit expertise through screen recordings and transform it into structured, searchable documentation.',
    images: ['/screenshot-02.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Outfit (Axiforma alternative) for headers, Inter for body */}
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="https://cdn.jsdelivr.net/npm/react-grab@latest/dist/index.js"
            strategy="afterInteractive"
            type="module"
          />
        )}
      </head>
      <body className="bg-background text-foreground antialiased" suppressHydrationWarning>
        <ClerkProviderWrapper>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </QueryProvider>
        </ClerkProviderWrapper>
      </body>
    </html>
  );
}

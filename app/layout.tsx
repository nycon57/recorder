import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';

import { Toaster } from '@/app/components/ui/sonner';
import { clerkAppearance } from '@/lib/clerk/appearance';
import { QueryProvider } from '@/lib/providers/query-provider';

import './globals.css';

// Force dynamic rendering to prevent static generation at build time
// Root layout uses ClerkProvider which requires runtime env vars
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  title: 'Record - AI-Powered Knowledge Management',
  description:
    'Record your screen and camera, automatically transcribe and generate documentation with AI.',
  keywords: 'screen recording, transcription, AI documentation, knowledge management',
  authors: [{ name: 'Record Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Record - AI-Powered Knowledge Management',
    description:
      'Record your screen and camera, automatically transcribe and generate documentation with AI.',
    type: 'website',
    url: 'https://record.addy.ie',
    images: [
      {
        url: '/screenshot-02.jpg',
        width: 1200,
        height: 630,
        alt: 'Record Screenshot',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Record - AI-Powered Knowledge Management',
    description:
      'Record your screen and camera, automatically transcribe and generate documentation with AI.',
    images: ['/screenshot-02.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" suppressHydrationWarning>
        <body suppressHydrationWarning>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/app/components/ui/sonner';
import './globals.css';

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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* CORS headers for FFMPEG.wasm (fallback for static pages) */}
          <meta httpEquiv="Cross-Origin-Opener-Policy" content="same-origin" />
          <meta
            httpEquiv="Cross-Origin-Embedder-Policy"
            content="require-corp"
          />
        </head>
        <body suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk/appearance';

/**
 * Client-side ClerkProvider wrapper
 * Ensures Clerk hooks work properly in Next.js 15 + Turbopack
 */
export function ClerkProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}

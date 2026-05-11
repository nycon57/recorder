'use client';

import Link from 'next/link';

/**
 * Global error boundary for App Router
 * Required to handle errors in the root layout
 * Must be a Client Component
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error - Something went wrong</title>
      </head>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="text-center space-y-6 max-w-md">
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold">Something went wrong</h1>
              {process.env.NODE_ENV === 'development' && error.message && (
                <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-md">
                  <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                    {error.message}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center pt-4">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

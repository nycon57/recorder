import { UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Nav */}
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <span className="text-2xl">🎥</span>
                <span className="text-xl font-bold text-foreground">
                  Record
                </span>
              </Link>

              <nav className="hidden md:flex space-x-6">
                <Link
                  href="/dashboard"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  Recordings
                </Link>
                <Link
                  href="/record"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  New Recording
                </Link>
                <Link
                  href="/search"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  Search
                </Link>
                <Link
                  href="/assistant"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  AI Assistant
                </Link>
                <Link
                  href="/settings"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  Settings
                </Link>
              </nav>
            </div>

            {/* User Menu & Org Switcher */}
            <div className="flex items-center space-x-4">
              {/*
                OrganizationSwitcher requires Organizations feature enabled in Clerk.
                To enable: dashboard.clerk.com → Organizations → Enable
                Uncomment below when Organizations are enabled:
              */}
              {process.env.NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED === 'true' && (
                <OrganizationSwitcher
                  appearance={{
                    elements: {
                      rootBox: 'flex items-center',
                    },
                  }}
                />
              )}
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-10 h-10',
                  },
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2025 Record. AI-Powered Knowledge Management.
            </p>
            <div className="flex space-x-6 text-sm">
              <a
                href="https://github.com/addyosmani/recorder"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                GitHub
              </a>
              <Link
                href="/docs"
                className="text-muted-foreground hover:text-foreground"
              >
                Documentation
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

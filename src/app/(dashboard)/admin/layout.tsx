'use client';

import { ReactNode, useState } from 'react';
import { Menu, X } from 'lucide-react';

import AdminNavigation from '@/app/components/admin/AdminNavigation';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)]">
      {/* Mobile Menu Toggle Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="fixed top-20 left-4 z-50 rounded-md border border-border bg-card/80 p-2 text-foreground backdrop-blur transition-colors hover:bg-muted lg:hidden"
        aria-expanded={mobileMenuOpen}
        aria-controls="admin-sidebar"
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={`
          w-72 border-r border-border bg-card/60 px-4 py-6 backdrop-blur
          lg:block lg:relative
          ${mobileMenuOpen ? 'fixed inset-y-0 left-0 z-40 block' : 'hidden'}
        `}
      >
        <AdminNavigation />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

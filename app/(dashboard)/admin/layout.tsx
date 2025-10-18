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
    <div className="flex min-h-screen">
      {/* Mobile Menu Toggle Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden rounded-md bg-background p-2 border shadow-md hover:bg-accent"
        aria-expanded={mobileMenuOpen}
        aria-controls="admin-sidebar"
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
          w-64 border-r bg-background p-6
          lg:block lg:relative
          ${mobileMenuOpen ? 'fixed inset-y-0 left-0 z-40 block' : 'hidden'}
        `}
      >
        <AdminNavigation />
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

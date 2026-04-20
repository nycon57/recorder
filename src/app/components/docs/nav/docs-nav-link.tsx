'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils/cn';
import type { DocsPage } from '@/lib/docs';

interface DocsNavLinkProps {
  page: DocsPage;
}

/**
 * Single nav link — amber accent on active, hover transition.
 * Detects active state client-side via usePathname().
 */
export function DocsNavLink({ page }: DocsNavLinkProps) {
  const pathname = usePathname();
  const href = `/docs/${page.slug}`;
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'block rounded-sm px-2 py-1.5 text-sm leading-snug transition-colors duration-150',
        isActive
          ? 'font-medium text-[color:var(--docs-amber)] bg-[color:var(--docs-amber)]/8'
          : 'text-[color:var(--docs-text-secondary)] hover:text-[color:var(--docs-text-primary)] hover:bg-[color:var(--docs-surface-hover)]',
      )}
    >
      {page.title}
    </Link>
  );
}

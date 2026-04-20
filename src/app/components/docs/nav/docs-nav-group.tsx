'use client';

import type { DocsPage } from '@/lib/docs';

import { DocsNavLink } from './docs-nav-link';

interface DocsNavGroupProps {
  group?: string;
  pages: DocsPage[];
}

/**
 * A named sub-group within a section, or an unnamed group (no header rendered).
 */
export function DocsNavGroup({ group, pages }: DocsNavGroupProps) {
  return (
    <div className="space-y-0.5">
      {group && (
        <p className="mb-1 mt-3 px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--docs-text-muted)]">
          {group}
        </p>
      )}
      {pages.map((page) => (
        <DocsNavLink key={page.slug} page={page} />
      ))}
    </div>
  );
}

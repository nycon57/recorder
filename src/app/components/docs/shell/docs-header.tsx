'use client';

import { useCallback } from 'react';

import type { Audience } from '@/lib/docs';
import { useDocsSearch } from '@/app/components/docs/search/docs-search-context';

import { DocsBreadcrumb, type BreadcrumbSegment } from './docs-breadcrumb';

const AUDIENCE_LABEL: Record<Audience, string> = {
  public: 'Docs',
  'org-admin': 'Admin',
  'system-admin': 'System',
};

interface DocsHeaderProps {
  audience: Audience;
  breadcrumbs?: BreadcrumbSegment[];
}

const EMPTY_BREADCRUMBS: BreadcrumbSegment[] = [];

/**
 * Utility bar: breadcrumbs left, audience badge + ⌘K search button right.
 *
 * Now a client component so it can call useDocsSearch() to open the dialog.
 * The search context is provided by DocsSearchProvider in the layout.
 */
export function DocsHeader({
  audience,
  breadcrumbs = EMPTY_BREADCRUMBS,
}: DocsHeaderProps) {
  const { open } = useDocsSearch();

  const handleSearchClick = useCallback(() => {
    open();
  }, [open]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[color:var(--docs-border)] bg-[color:var(--docs-surface)] px-6">
      {/* Breadcrumb */}
      <div className="min-w-0 flex-1">
        <DocsBreadcrumb segments={breadcrumbs} />
      </div>

      {/* Right utility strip */}
      <div className="ml-4 flex shrink-0 items-center gap-3">
        {/* Audience badge — amber only on non-public audiences */}
        {audience !== 'public' && (
          <span className="rounded-sm border border-[color:var(--docs-amber)]/40 bg-[color:var(--docs-amber)]/8 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--docs-amber)]">
            {AUDIENCE_LABEL[audience]}
          </span>
        )}

        {/* ⌘K search button */}
        <button
          type="button"
          onClick={handleSearchClick}
          aria-label="Search docs"
          aria-keyshortcuts="Meta+K Control+K"
          className="hidden items-center gap-1 rounded border border-[color:var(--docs-border)] bg-[color:var(--docs-surface-hover)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--docs-text-muted)] transition-colors hover:border-[color:var(--docs-amber)]/40 hover:text-[color:var(--docs-text-secondary)] sm:inline-flex"
        >
          <span className="text-[11px]">⌘</span>K
        </button>
      </div>
    </header>
  );
}

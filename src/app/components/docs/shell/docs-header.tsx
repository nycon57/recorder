import type { Audience } from '@/lib/docs';

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

/**
 * Utility bar: breadcrumbs left, audience badge + search hint right.
 * Server component — no interactivity.
 */
export function DocsHeader({ audience, breadcrumbs = [] }: DocsHeaderProps) {
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

        {/* Search hint slot — wired in TRIB-155 */}
        <kbd className="hidden items-center gap-1 rounded border border-[color:var(--docs-border)] bg-[color:var(--docs-surface-hover)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--docs-text-muted)] sm:inline-flex">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </div>
    </header>
  );
}

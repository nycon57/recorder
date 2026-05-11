'use client';

import Link from 'next/link';

import { ScrollArea } from '@/app/components/ui/scroll-area';
import type { Audience, DocsNavTree } from '@/lib/docs';

import { DocsNavSection } from './docs-nav-section';

interface DocsNavProps {
  tree: DocsNavTree;
  audience: Audience;
}

/**
 * Sidebar navigation — renders the full nav tree filtered for the current audience.
 * Scrollable, fixed width on desktop, rendered inside a Sheet on mobile.
 */
export function DocsNav({ tree }: DocsNavProps) {
  return (
    <nav
      aria-label="Documentation navigation"
      className="flex h-full w-64 flex-col border-r border-[color:var(--docs-border)] bg-[color:var(--docs-surface)]"
    >
      {/* Brand / title bar */}
      <div className="flex h-14 shrink-0 items-center border-b border-[color:var(--docs-border)] px-4">
        <Link
          href="/docs"
          className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold tracking-tight text-[color:var(--docs-text-primary)] transition-colors hover:text-[color:var(--docs-amber)]"
        >
          Documentation
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {tree.sections.map(({ section, groups }) => (
          <DocsNavSection key={section.id} section={section} groups={groups} />
        ))}

        {tree.sections.length === 0 && (
          <p className="px-2 text-sm text-[color:var(--docs-text-muted)]">
            No content available.
          </p>
        )}
      </ScrollArea>
    </nav>
  );
}

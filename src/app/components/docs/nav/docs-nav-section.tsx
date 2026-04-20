'use client';

import Link from 'next/link';

import type { DocsSection, DocsPage } from '@/lib/docs';

import { DocsNavGroup } from './docs-nav-group';

interface DocsNavSectionProps {
  section: DocsSection;
  groups: Array<{ group?: string; pages: DocsPage[] }>;
}

/**
 * A single collapsible-style section in the sidebar nav.
 * The section title links to its index page.
 */
export function DocsNavSection({ section, groups }: DocsNavSectionProps) {
  const hasPages = groups.some((g) => g.pages.length > 0);
  if (!hasPages) return null;

  return (
    <div className="mb-5">
      <Link
        href={`/docs/${section.id}`}
        className="mb-1.5 block px-2 font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--docs-text-primary)] transition-colors hover:text-[color:var(--docs-amber)]"
      >
        {section.title}
      </Link>
      {groups.map((g, i) => (
        <DocsNavGroup key={g.group ?? `__ungrouped_${i}`} group={g.group} pages={g.pages} />
      ))}
    </div>
  );
}

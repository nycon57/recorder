import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';

import { resolveDocsAudience, getDocsRegistry, resolveAccess } from '@/lib/docs';
import type { SectionId } from '@/lib/docs';
import { DocsLanding } from '@/app/components/docs/landing/docs-landing';
import { DocsPlaceholder } from '@/app/components/docs/placeholder/docs-placeholder';
import { DocsSectionIndex } from '@/app/components/docs/section-index/docs-section-index';

// Prevent stale access decisions being served from cache.
export const dynamic = 'force-dynamic';

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug: slugParts } = await params;

  const reqHeaders = await headers();
  const { audience } = await resolveDocsAudience(reqHeaders);

  const registry = await getDocsRegistry();

  // ── /docs (bare root) ────────────────────────────────────────────────────────
  if (!slugParts || slugParts.length === 0) {
    const sections = registry.sectionsForAudience(audience);
    return <DocsLanding audience={audience} sections={sections} />;
  }

  const joinedSlug = slugParts.join('/');

  // ── Exact page match ──────────────────────────────────────────────────────────
  const page = registry.findPage(joinedSlug);
  if (page) {
    const decision = resolveAccess(audience, page.audience, joinedSlug);

    if (decision.kind === 'redirect') {
      redirect(decision.to);
    }
    if (decision.kind === 'notFound') {
      notFound();
    }

    // kind === 'render'
    return <DocsPlaceholder page={page} />;
  }

  // ── Section index match ───────────────────────────────────────────────────────
  // A single slug segment that exactly matches a SectionId renders the section index.
  if (slugParts.length === 1) {
    const sectionId = slugParts[0] as SectionId;
    const section = registry.sections.find((s) => s.id === sectionId);

    if (section) {
      // Apply the same access rules to the section itself.
      const decision = resolveAccess(audience, section.audience, joinedSlug);

      if (decision.kind === 'redirect') {
        redirect(decision.to);
      }
      if (decision.kind === 'notFound') {
        notFound();
      }

      // Filter pages visible to this audience within the section.
      const sectionPages = registry.pagesForAudience(audience).filter(
        (p) => p.section === section.id && !p.unlisted,
      );

      return <DocsSectionIndex section={section} pages={sectionPages} />;
    }
  }

  // ── No match ─────────────────────────────────────────────────────────────────
  notFound();
}

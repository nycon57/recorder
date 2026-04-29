import crypto from 'node:crypto';

import {
  sanitizePageContextForModel,
  type LiveContextPack,
  type PageContext,
} from '@tribora/shared';

export interface LiveContextSourcePage {
  id: string;
  title: string;
  content: string;
  kind: 'org' | 'vendor_training' | 'vendor_generic';
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function clipSnippet(value: string, limit = 260): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

function buildSourceSection(
  label: string,
  pages: LiveContextSourcePage[],
): string {
  return [
    `${label}:`,
    ...pages.slice(0, 2).map((page) => {
      const snippet = clipSnippet(page.content);
      return `- ${page.title} [${page.id}]: ${snippet}`;
    }),
  ].join('\n');
}

function buildSelectorHints(context: PageContext): string | null {
  const selectorHints = Array.from(
    new Set([
      ...(context.orgKnowledgeMatch?.selectorHints ?? []),
      ...(context.vendorKnowledgeMatch?.selectorHints ?? []),
    ]),
  ).slice(0, 5);

  if (selectorHints.length === 0) return null;
  return `SELECTOR HINTS:\n- ${selectorHints.join('\n- ')}`;
}

export function buildLiveContextPack(args: {
  context: PageContext;
  orgPages: LiveContextSourcePage[];
  vendorPages: LiveContextSourcePage[];
}): LiveContextPack {
  const { orgPages, vendorPages } = args;
  const context = sanitizePageContextForModel(args.context);
  const sections: string[] = [];

  sections.push(
    [
      'CURRENT PAGE:',
      `- App: ${context.app}`,
      `- Screen: ${context.screen}`,
      context.selectedEntity?.title
        ? `- Selected entity: ${context.selectedEntity.title}`
        : null,
      context.pageSummary
        ? `- Summary: ${clipSnippet(context.pageSummary, 320)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  if (orgPages.length > 0) {
    sections.push(buildSourceSection('TEAM-SPECIFIC GUIDANCE', orgPages));
  }

  if (vendorPages.length > 0) {
    sections.push(buildSourceSection('VENDOR GUIDANCE', vendorPages));
  }

  const selectorHints = buildSelectorHints(context);
  if (selectorHints) {
    sections.push(selectorHints);
  }

  if (orgPages.length === 0 && vendorPages.length === 0) {
    sections.push(
      [
        'KNOWLEDGE STATUS:',
        '- No matched vendor or team-specific knowledge is loaded for this page.',
        '- Answer from the current page structure, state limits plainly, and avoid claiming team-specific workflow knowledge.',
      ].join('\n'),
    );
  }

  const text = sections.join('\n\n');
  const hash = crypto.createHash('sha256').update(text).digest('hex');

  return {
    hash,
    text,
    knowledgeMode: context.knowledgeAvailability?.mode ?? 'dom_only',
    sources: [
      ...orgPages.map((page) => ({
        id: page.id,
        title: page.title,
        kind: page.kind,
      })),
      ...vendorPages.map((page) => ({
        id: page.id,
        title: page.title,
        kind: page.kind,
      })),
    ],
  };
}

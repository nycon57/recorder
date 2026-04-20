import { resolveAccess } from '../access';
import type { Audience } from '../types';

type Case = {
  caller: Audience;
  required: Audience;
  slug: string;
  expectedKind: 'render' | 'redirect' | 'notFound';
  expectedTo?: string;
};

const MATRIX: Case[] = [
  // ── §4 visibility matrix ─────────────────────────────────────────────────
  { caller: 'public',       required: 'public',       slug: 'foo',     expectedKind: 'render' },
  { caller: 'public',       required: 'org-admin',    slug: 'foo',     expectedKind: 'redirect', expectedTo: '/login?next=%2Fdocs%2Ffoo' },
  { caller: 'public',       required: 'system-admin', slug: 'foo',     expectedKind: 'notFound' },
  { caller: 'org-admin',    required: 'public',       slug: 'foo',     expectedKind: 'render' },
  { caller: 'org-admin',    required: 'org-admin',    slug: 'foo',     expectedKind: 'render' },
  { caller: 'org-admin',    required: 'system-admin', slug: 'foo',     expectedKind: 'notFound' },
  { caller: 'system-admin', required: 'public',       slug: 'foo',     expectedKind: 'render' },
  { caller: 'system-admin', required: 'org-admin',    slug: 'foo',     expectedKind: 'render' },
  { caller: 'system-admin', required: 'system-admin', slug: 'foo',     expectedKind: 'render' },
];

describe('resolveAccess — §4 visibility matrix', () => {
  test.each(MATRIX)(
    '$caller → $required ($slug) = $expectedKind',
    ({ caller, required, slug, expectedKind, expectedTo }) => {
      const decision = resolveAccess(caller, required, slug);
      expect(decision.kind).toBe(expectedKind);
      if (expectedKind === 'redirect') {
        expect((decision as { kind: 'redirect'; to: string }).to).toBe(expectedTo);
      }
    },
  );
});

describe('resolveAccess — slug edge cases', () => {
  test('slug with nested path → redirect encodes full path', () => {
    const decision = resolveAccess('public', 'org-admin', 'org-admin/members');
    expect(decision.kind).toBe('redirect');
    expect((decision as { kind: 'redirect'; to: string }).to).toBe(
      '/login?next=%2Fdocs%2Forg-admin%2Fmembers',
    );
  });

  test('slug with leading/trailing whitespace is trimmed', () => {
    const decision = resolveAccess('public', 'org-admin', '  knowledge-ops  ');
    expect(decision.kind).toBe('redirect');
    expect((decision as { kind: 'redirect'; to: string }).to).toBe(
      '/login?next=%2Fdocs%2Fknowledge-ops',
    );
  });

  test('empty slug (docs root) → redirect to /docs', () => {
    const decision = resolveAccess('public', 'org-admin', '');
    expect(decision.kind).toBe('redirect');
    expect((decision as { kind: 'redirect'; to: string }).to).toBe(
      '/login?next=%2Fdocs',
    );
  });

  test('whitespace-only slug (docs root) → redirect to /docs', () => {
    const decision = resolveAccess('public', 'org-admin', '   ');
    expect(decision.kind).toBe('redirect');
    expect((decision as { kind: 'redirect'; to: string }).to).toBe(
      '/login?next=%2Fdocs',
    );
  });
});

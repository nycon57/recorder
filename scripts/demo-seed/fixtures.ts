/**
 * Single source of truth for all demo tenant fixtures.
 *
 * Import DEMO_ORG_ID and DEMO_USER_IDS from here in downstream consumers
 * (TRIB-148 content seed, TRIB-151 reset hook).
 *
 * DO NOT modify the ID derivation inputs — they are frozen.
 */

import {
  deriveAccountId,
  deriveDepartmentId,
  deriveMemberId,
  deriveOrgId,
  deriveUserId,
} from './ids.js';

// ─── Organization ────────────────────────────────────────────────────────────

// DO NOT ROTATE DEMO_SEED_NAMESPACE — see scripts/demo-seed/ids.ts
export const DEMO_ORG_SLUG = 'acme-support-demo';

export const DEMO_ORG_ID = deriveOrgId(DEMO_ORG_SLUG);

export const DEMO_ORG = {
  id: DEMO_ORG_ID,
  name: 'Acme Support Demo',
  slug: DEMO_ORG_SLUG,
  plan: 'pro' as const,
  billing_email: 'billing@demo.tribora.test',
  metadata: JSON.stringify({ seed: 'demo', generated_by: 'scripts/demo-seed' }),
  created_at: '2026-01-01T00:00:00.000Z',
  onboarded_at: '2026-01-01T00:00:00.000Z',
} as const;

// ─── Departments ─────────────────────────────────────────────────────────────

export const DEMO_DEPARTMENT_SLUGS = {
  executive: 'executive',
  supportOps: 'support-ops',
  support: 'support',
} as const;

export const DEMO_DEPARTMENT_IDS = {
  executive: deriveDepartmentId(DEMO_ORG_ID, DEMO_DEPARTMENT_SLUGS.executive),
  supportOps: deriveDepartmentId(DEMO_ORG_ID, DEMO_DEPARTMENT_SLUGS.supportOps),
  support: deriveDepartmentId(DEMO_ORG_ID, DEMO_DEPARTMENT_SLUGS.support),
} as const;

export const DEMO_DEPARTMENTS = [
  {
    id: DEMO_DEPARTMENT_IDS.executive,
    org_id: DEMO_ORG_ID,
    name: 'Executive',
    slug: DEMO_DEPARTMENT_SLUGS.executive,
    description: 'Executive leadership',
    default_visibility: 'org' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: DEMO_DEPARTMENT_IDS.supportOps,
    org_id: DEMO_ORG_ID,
    name: 'Support Ops',
    slug: DEMO_DEPARTMENT_SLUGS.supportOps,
    description: 'Support operations and quality',
    default_visibility: 'department' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: DEMO_DEPARTMENT_IDS.support,
    org_id: DEMO_ORG_ID,
    name: 'Support',
    slug: DEMO_DEPARTMENT_SLUGS.support,
    description: 'Customer support team',
    default_visibility: 'department' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  },
] as const;

// ─── Users ───────────────────────────────────────────────────────────────────

export interface DemoUser {
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'contributor' | 'reader';
  title: string;
  departmentSlug: keyof typeof DEMO_DEPARTMENT_SLUGS;
  // Derived at build time:
  id: string;
  accountId: string;
  memberId: string;
}

const SEED_CREATED_AT = '2026-01-01T00:00:00.000Z';

function makeUser(
  email: string,
  name: string,
  role: DemoUser['role'],
  title: string,
  departmentSlug: DemoUser['departmentSlug']
): DemoUser {
  const id = deriveUserId(email);
  return {
    email,
    name,
    role,
    title,
    departmentSlug,
    id,
    accountId: deriveAccountId(id),
    memberId: deriveMemberId(DEMO_ORG_ID, id),
  };
}

export const DEMO_USERS: DemoUser[] = [
  makeUser(
    'owner@demo.tribora.test',
    'Dana Okafor',
    'owner',
    'VP Customer Experience',
    'executive'
  ),
  makeUser(
    'admin@demo.tribora.test',
    'Priya Rangan',
    'admin',
    'Head of Support Ops',
    'supportOps'
  ),
  makeUser(
    'lead@demo.tribora.test',
    'Marcus Chen',
    'contributor',
    'Senior Support Engineer',
    'support'
  ),
  makeUser(
    'agent@demo.tribora.test',
    'Sofía Alvarez',
    'contributor',
    'Support Agent',
    'support'
  ),
  makeUser(
    'reader@demo.tribora.test',
    'Jordan Blake',
    'reader',
    'New Hire — Support',
    'support'
  ),
];

// Named exports for convenient downstream imports (TRIB-148, TRIB-151).
export const DEMO_USER_IDS = {
  owner: deriveUserId('owner@demo.tribora.test'),
  admin: deriveUserId('admin@demo.tribora.test'),
  lead: deriveUserId('lead@demo.tribora.test'),
  agent: deriveUserId('agent@demo.tribora.test'),
  reader: deriveUserId('reader@demo.tribora.test'),
} as const;

export { SEED_CREATED_AT };

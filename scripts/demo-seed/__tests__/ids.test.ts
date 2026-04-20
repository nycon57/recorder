import {
  deriveOrgId,
  deriveUserId,
  deriveMemberId,
  deriveAccountId,
  deriveDepartmentId,
  DEMO_SEED_NAMESPACE,
} from '../ids';

describe('DEMO_SEED_NAMESPACE', () => {
  it('is a valid UUID-format string (hex only)', () => {
    expect(DEMO_SEED_NAMESPACE).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('is frozen to the expected value', () => {
    expect(DEMO_SEED_NAMESPACE).toBe('6f4c0b8a-8f2a-4d7e-9b11-000000000000');
  });
});

describe('deriveOrgId', () => {
  it('returns a stable UUID across calls', () => {
    expect(deriveOrgId('acme-support-demo')).toBe(deriveOrgId('acme-support-demo'));
  });

  it('returns a valid UUID', () => {
    expect(deriveOrgId('acme-support-demo')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('returns different IDs for different slugs', () => {
    expect(deriveOrgId('acme-support-demo')).not.toBe(deriveOrgId('other-org'));
  });
});

describe('deriveUserId', () => {
  it('returns stable UUIDs across calls', () => {
    const email = 'owner@demo.tribora.test';
    expect(deriveUserId(email)).toBe(deriveUserId(email));
  });

  it('is case-insensitive on email', () => {
    expect(deriveUserId('Owner@Demo.Tribora.Test')).toBe(
      deriveUserId('owner@demo.tribora.test')
    );
  });

  it('returns unique IDs for each demo user email', () => {
    const ids = [
      'owner@demo.tribora.test',
      'admin@demo.tribora.test',
      'lead@demo.tribora.test',
      'agent@demo.tribora.test',
      'reader@demo.tribora.test',
    ].map(deriveUserId);

    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('returns different IDs from deriveOrgId', () => {
    expect(deriveUserId('owner@demo.tribora.test')).not.toBe(
      deriveOrgId('acme-support-demo')
    );
  });
});

describe('deriveMemberId', () => {
  const orgId = deriveOrgId('acme-support-demo');
  const userId = deriveUserId('owner@demo.tribora.test');

  it('returns a stable UUID', () => {
    expect(deriveMemberId(orgId, userId)).toBe(deriveMemberId(orgId, userId));
  });

  it('returns unique IDs across users', () => {
    const emails = [
      'owner@demo.tribora.test',
      'admin@demo.tribora.test',
      'lead@demo.tribora.test',
      'agent@demo.tribora.test',
      'reader@demo.tribora.test',
    ];
    const ids = emails.map((e) => deriveMemberId(orgId, deriveUserId(e)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('differs from userId and orgId', () => {
    const memberId = deriveMemberId(orgId, userId);
    expect(memberId).not.toBe(orgId);
    expect(memberId).not.toBe(userId);
  });
});

describe('deriveAccountId', () => {
  it('returns a stable UUID', () => {
    const userId = deriveUserId('owner@demo.tribora.test');
    expect(deriveAccountId(userId)).toBe(deriveAccountId(userId));
  });

  it('differs from the userId it is derived from', () => {
    const userId = deriveUserId('owner@demo.tribora.test');
    expect(deriveAccountId(userId)).not.toBe(userId);
  });

  it('is unique across all five demo users', () => {
    const emails = [
      'owner@demo.tribora.test',
      'admin@demo.tribora.test',
      'lead@demo.tribora.test',
      'agent@demo.tribora.test',
      'reader@demo.tribora.test',
    ];
    const ids = emails.map((e) => deriveAccountId(deriveUserId(e)));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('deriveDepartmentId', () => {
  const orgId = deriveOrgId('acme-support-demo');

  it('returns stable UUIDs', () => {
    expect(deriveDepartmentId(orgId, 'support')).toBe(
      deriveDepartmentId(orgId, 'support')
    );
  });

  it('returns unique IDs for each department slug', () => {
    const slugs = ['executive', 'support-ops', 'support'];
    const ids = slugs.map((s) => deriveDepartmentId(orgId, s));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

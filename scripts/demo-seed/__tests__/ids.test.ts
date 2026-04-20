import {
  deriveOrgId,
  deriveUserId,
  deriveMemberId,
  deriveAccountId,
  deriveDepartmentId,
  deriveRecordingId,
  deriveDocumentId,
  deriveSummaryId,
  deriveTranscriptId,
  deriveChunkId,
  deriveWikiPageId,
  deriveWikiSourceId,
  deriveImportedDocId,
  deriveKnowledgeGapId,
  deriveShareId,
  deriveTagId,
  deriveVendorOrgId,
  deriveWhiteLabelConfigId,
  deriveConnectorId,
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

// ─── TRIB-148 content entity helpers ─────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = 'onboarding-zendesk-01';

describe('deriveRecordingId', () => {
  it('is stable across calls', () => {
    expect(deriveRecordingId(SLUG)).toBe(deriveRecordingId(SLUG));
  });
  it('returns a valid UUID', () => {
    expect(deriveRecordingId(SLUG)).toMatch(UUID_RE);
  });
  it('differs from deriveDocumentId for same slug', () => {
    expect(deriveRecordingId(SLUG)).not.toBe(deriveDocumentId(SLUG));
  });
  it('is unique across 30 slugs', () => {
    const slugs = Array.from({ length: 30 }, (_, i) => `recording-${String(i).padStart(2, '0')}`);
    const ids = slugs.map(deriveRecordingId);
    expect(new Set(ids).size).toBe(30);
  });
});

describe('deriveDocumentId / deriveSummaryId / deriveTranscriptId', () => {
  it('all return stable UUIDs', () => {
    expect(deriveDocumentId(SLUG)).toBe(deriveDocumentId(SLUG));
    expect(deriveSummaryId(SLUG)).toBe(deriveSummaryId(SLUG));
    expect(deriveTranscriptId(SLUG)).toBe(deriveTranscriptId(SLUG));
  });
  it('all produce distinct values for the same slug', () => {
    const ids = [
      deriveRecordingId(SLUG),
      deriveDocumentId(SLUG),
      deriveSummaryId(SLUG),
      deriveTranscriptId(SLUG),
    ];
    expect(new Set(ids).size).toBe(4);
  });
});

describe('deriveChunkId', () => {
  it('is stable', () => {
    expect(deriveChunkId(SLUG, 0)).toBe(deriveChunkId(SLUG, 0));
  });
  it('differs by chunk index', () => {
    expect(deriveChunkId(SLUG, 0)).not.toBe(deriveChunkId(SLUG, 1));
  });
  it('produces 6 unique IDs for 6 chunks', () => {
    const ids = Array.from({ length: 6 }, (_, i) => deriveChunkId(SLUG, i));
    expect(new Set(ids).size).toBe(6);
  });
});

describe('deriveWikiPageId', () => {
  it('is stable', () => {
    expect(deriveWikiPageId('zendesk-onboarding-new-agent')).toBe(
      deriveWikiPageId('zendesk-onboarding-new-agent')
    );
  });
  it('is unique across 12 slugs', () => {
    const slugs = [
      'zendesk-onboarding-new-agent', 'zendesk-sla-business-hours',
      'zendesk-macros-views-setup', 'zendesk-talk-voice-integration',
      'hubspot-partial-refund-playbook', 'hubspot-stripe-reconciliation',
      'hubspot-dual-approval-workflow', 'hubspot-deal-refund-properties',
      'jira-bug-from-zendesk', 'jira-triage-labels',
      'jira-rovo-integration', 'jira-sprint-handoff',
    ];
    const ids = slugs.map(deriveWikiPageId);
    expect(new Set(ids).size).toBe(12);
  });
});

describe('deriveWikiSourceId', () => {
  it('is stable', () => {
    expect(deriveWikiSourceId('page-slug', 'rec-slug')).toBe(
      deriveWikiSourceId('page-slug', 'rec-slug')
    );
  });
  it('differs when page or rec slug differs', () => {
    expect(deriveWikiSourceId('page-a', 'rec-1')).not.toBe(
      deriveWikiSourceId('page-b', 'rec-1')
    );
    expect(deriveWikiSourceId('page-a', 'rec-1')).not.toBe(
      deriveWikiSourceId('page-a', 'rec-2')
    );
  });
});

describe('deriveImportedDocId / deriveKnowledgeGapId / deriveShareId', () => {
  it('are all stable', () => {
    expect(deriveImportedDocId('zendesk-admin-guide')).toBe(deriveImportedDocId('zendesk-admin-guide'));
    expect(deriveKnowledgeGapId('stripe-webhook-retry')).toBe(deriveKnowledgeGapId('stripe-webhook-retry'));
    expect(deriveShareId('share-onboarding')).toBe(deriveShareId('share-onboarding'));
  });
  it('are mutually distinct', () => {
    const ids = [
      deriveImportedDocId('slug'),
      deriveKnowledgeGapId('slug'),
      deriveShareId('slug'),
    ];
    expect(new Set(ids).size).toBe(3);
  });
});

describe('deriveTagId', () => {
  const orgId = deriveOrgId('acme-support-demo');
  it('is case-insensitive on tag name', () => {
    expect(deriveTagId(orgId, 'Refund')).toBe(deriveTagId(orgId, 'refund'));
  });
  it('is stable', () => {
    expect(deriveTagId(orgId, 'refund')).toBe(deriveTagId(orgId, 'refund'));
  });
  it('is unique across 6 tag names', () => {
    const names = ['refund', 'onboarding', 'integration', 'zendesk', 'hubspot', 'jira'];
    const ids = names.map((n) => deriveTagId(orgId, n));
    expect(new Set(ids).size).toBe(6);
  });
});

describe('deriveVendorOrgId / deriveWhiteLabelConfigId / deriveConnectorId', () => {
  it('are stable', () => {
    const vendorId = deriveVendorOrgId();
    expect(vendorId).toBe(deriveVendorOrgId());
    expect(deriveWhiteLabelConfigId(vendorId)).toBe(deriveWhiteLabelConfigId(vendorId));
    const orgId = deriveOrgId('acme-support-demo');
    expect(deriveConnectorId(orgId, 'zendesk')).toBe(deriveConnectorId(orgId, 'zendesk'));
  });
  it('all return valid UUIDs', () => {
    const vendorId = deriveVendorOrgId();
    const orgId = deriveOrgId('acme-support-demo');
    expect(vendorId).toMatch(UUID_RE);
    expect(deriveWhiteLabelConfigId(vendorId)).toMatch(UUID_RE);
    expect(deriveConnectorId(orgId, 'zendesk')).toMatch(UUID_RE);
  });
  it('vendor org differs from Acme org', () => {
    expect(deriveVendorOrgId()).not.toBe(deriveOrgId('acme-support-demo'));
  });
});

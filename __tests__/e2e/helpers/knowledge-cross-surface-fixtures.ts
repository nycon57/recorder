import type { CompiledMemoryContext } from '../../../src/lib/services/compiled-memory-context';

const EMPTY_FRESHNESS = {
  updatedAt: null,
  lastSuccessfulSyncAt: null,
  freshnessTarget: null,
  isStale: null,
} as const;

function provenance(pageId: string, sourceUrl: string | null = null) {
  return {
    pageId,
    vendorPageId: null,
    vendorSourceId: null,
    sourceKind: null,
    sourceUrl,
  };
}

export function createCompiledMemoryContextFixture(): CompiledMemoryContext {
  return {
    vendorKnowledge: {
      page: {
        id: 'vendor-hubspot-deals',
        app: 'hubspot',
        app_version: null,
        screen: 'deals',
        content: 'Vendor baseline says route enterprise deal escalations to RevOps.',
        element_selectors: null,
        source_url: 'https://docs.vendor.example/hubspot/deals',
        content_hash: null,
        vendor_source_id: null,
        curated_by: null,
        ingest_job_id: null,
        last_seen_at: null,
        retired_at: null,
        retired_by: null,
        retirement_reason: null,
        created_at: null,
        updated_at: null,
      },
      pages: [
        {
          id: 'vendor-hubspot-deals',
          vendorPageId: 'vendor-hubspot-deals',
          vendorSourceId: null,
          app: 'hubspot',
          screen: 'deals',
          title: 'HubSpot Deals',
          content: 'Vendor baseline says route enterprise deal escalations to RevOps.',
          sourceUrl: 'https://docs.vendor.example/hubspot/deals',
          updatedAt: '2026-04-19T15:00:00.000Z',
          confidence: 0.8,
          distance: 0.2,
          matchType: 'exact',
        },
      ],
    },
    vendorTraining: {
      pages: [
        {
          id: 'training-hubspot-revops',
          app: 'hubspot',
          screen: 'deals',
          topic: 'Vendor training: deal escalation',
          content: 'Training confirms RevOps should validate ownership before reassignment.',
          confidence: 0.83,
          distance: 0.17,
        },
      ],
    },
    orgKnowledge: {
      pages: [
        {
          id: 'org-deal-escalation-playbook',
          app: 'hubspot',
          screen: 'deals',
          topic: 'Deal escalation playbook',
          content:
            'Org policy: enterprise deal escalations bypass SDR and go to named account executives.',
          confidence: 0.94,
          distance: 0.06,
        },
      ],
      priorTopics: ['deal-escalation-playbook'],
    },
    citationsBySourceId: {
      'org-deal-escalation-playbook': {
        sourceId: 'org-deal-escalation-playbook',
        title: 'Deal escalation playbook',
        layer: 'org',
        linkUrl: '/knowledge/pages/org-deal-escalation-playbook',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('org-deal-escalation-playbook'),
      },
      'training-hubspot-revops': {
        sourceId: 'training-hubspot-revops',
        title: 'Vendor training: deal escalation',
        layer: 'vendor_training',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('training-hubspot-revops'),
      },
      'vendor-hubspot-deals': {
        sourceId: 'vendor-hubspot-deals',
        title: 'HubSpot Deals',
        layer: 'vendor',
        linkUrl: 'https://docs.vendor.example/hubspot/deals',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance(
          'vendor-hubspot-deals',
          'https://docs.vendor.example/hubspot/deals',
        ),
      },
    },
  };
}

export function createKnowledgeDocsAssemblyFixture() {
  return {
    pages: [
      {
        id: 'org-deal-escalation-playbook',
        app: 'HubSpot',
        screen: 'Deals',
        topic: 'Deal escalation playbook',
        confidence: 0.94,
        valid_until: null,
        cluster_id: 'cluster-revops',
        updated_at: '2026-04-19T15:00:00.000Z',
        compilation_log: [],
      },
      {
        id: 'org-handoff-needs-review',
        app: 'HubSpot',
        screen: 'Deals',
        topic: 'Deal handoff checklist',
        confidence: 0.78,
        valid_until: null,
        cluster_id: null,
        updated_at: '2026-04-18T15:00:00.000Z',
        compilation_log: [
          {
            action: 'flagged',
            source_recording_id: 'recording-ops-2',
            detected_at: '2026-04-18T14:00:00.000Z',
            resolved_at: null,
          },
        ],
      },
    ],
    pageSources: [
      {
        page_id: 'org-deal-escalation-playbook',
        source_type: 'recording' as const,
        source_id: 'recording-ops-1',
      },
      {
        page_id: 'org-handoff-needs-review',
        source_type: 'document' as const,
        source_id: 'document-ops-1',
      },
    ],
    clusters: [{ id: 'cluster-revops', name: 'Revenue Ops' }],
    vendorPages: [{ app: 'hubspot', screen: 'deals' }],
  };
}

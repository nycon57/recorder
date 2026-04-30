import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  resolveVendorCorpusPages,
  syncVendorCorpusFromLegacyPages,
} from '../vendor-doc-corpus';

type VendorDocCorpusDeps = NonNullable<
  Parameters<typeof syncVendorCorpusFromLegacyPages>[1]
>;

type LegacyVendorPage = {
  id: string;
  app: string;
  screen: string;
  content: string;
  source_url: string | null;
  content_hash: string | null;
  vendor_source_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type VendorCorpusRow = {
  id: string;
  app: string;
  screen: string | null;
  title: string;
  normalized_content: string;
  content_excerpt: string;
  source_url: string | null;
  vendor_page_id: string | null;
  vendor_source_id: string | null;
  content_hash: string;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
};

describe('vendor-doc-corpus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('syncs changed legacy vendor pages into normalized corpus rows while skipping unchanged pages', async () => {
    const legacyPages: LegacyVendorPage[] = [
      {
        id: 'vendor-page-1',
        app: 'hubspot',
        screen: 'deals',
        content: '# Deals overview\n\nPipeline basics and stage names.',
        source_url: 'https://docs.example.com/deals',
        content_hash: 'hash-deals',
        vendor_source_id: 'source-1',
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
      {
        id: 'vendor-page-2',
        app: 'hubspot',
        screen: 'automations',
        content:
          'Set up workflows to automate assignment rules and follow-up steps.',
        source_url: 'https://docs.example.com/automations',
        content_hash: 'hash-automations-next',
        vendor_source_id: 'source-1',
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
    ];

    const existingRows: VendorCorpusRow[] = [
      {
        id: 'corpus-1',
        app: 'hubspot',
        screen: 'deals',
        title: 'Deals overview',
        normalized_content: 'Deals overview\n\nPipeline basics and stage names.',
        content_excerpt: 'Deals overview Pipeline basics and stage names.',
        source_url: 'https://docs.example.com/deals',
        vendor_page_id: 'vendor-page-1',
        vendor_source_id: 'source-1',
        content_hash: 'hash-deals',
        embedding: [0.9, 0.1],
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
      {
        id: 'corpus-2',
        app: 'hubspot',
        screen: 'automations',
        title: 'Automations',
        normalized_content: 'Old automation guidance.',
        content_excerpt: 'Old automation guidance.',
        source_url: 'https://docs.example.com/automations',
        vendor_page_id: 'vendor-page-2',
        vendor_source_id: 'source-1',
        content_hash: 'hash-automations-old',
        embedding: [0.2, 0.8],
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
    ];

    const upsert = jest.fn(async () => ({ error: null }));
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'vendor_wiki_pages') {
          const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({
              data: legacyPages,
              error: null,
            })),
          };
          return {
            ...query,
          };
        }

        if (table === 'vendor_corpus_pages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(async () => ({
              data: existingRows,
              error: null,
            })),
            delete: jest.fn().mockReturnThis(),
            in: jest.fn(async () => ({ error: null })),
            upsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const generateEmbedding =
      jest.fn<NonNullable<VendorDocCorpusDeps['generateEmbedding']>>();
    generateEmbedding.mockResolvedValue({
      embedding: [0.7, 0.3],
      provider: 'google' as const,
    });

    const result = await syncVendorCorpusFromLegacyPages(
      { app: 'hubspot' },
      {
        supabase: supabase as unknown as VendorDocCorpusDeps['supabase'],
        generateEmbedding:
          generateEmbedding as unknown as VendorDocCorpusDeps['generateEmbedding'],
      },
    );

    expect(generateEmbedding).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          app: 'hubspot',
          screen: 'automations',
          title: 'Automations',
          vendor_page_id: 'vendor-page-2',
          vendor_source_id: 'source-1',
          content_hash: 'hash-automations-next',
          source_url: 'https://docs.example.com/automations',
        }),
      ],
      expect.objectContaining({
        onConflict: 'vendor_page_id',
      }),
    );
    expect(result).toEqual({
      inserted: 0,
      updated: 1,
      skipped: 1,
    });
  });

  it('deletes stale corpus rows when every legacy vendor page is retired', async () => {
    const deleteFromCorpus = jest.fn().mockReturnThis();
    const deleteIds = jest.fn(async () => ({ error: null }));
    const generateEmbedding =
      jest.fn<NonNullable<VendorDocCorpusDeps['generateEmbedding']>>();
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'vendor_wiki_pages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({
              data: [],
              error: null,
            })),
          };
        }

        if (table === 'vendor_corpus_pages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(async () => ({
              data: [
                {
                  id: 'corpus-retired',
                  vendor_page_id: 'retired-page',
                  content_hash: 'old-hash',
                  embedding: [0.1],
                },
              ],
              error: null,
            })),
            delete: deleteFromCorpus,
            in: deleteIds,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await syncVendorCorpusFromLegacyPages(
      { app: 'hubspot' },
      {
        supabase: supabase as unknown as VendorDocCorpusDeps['supabase'],
        generateEmbedding:
          generateEmbedding as unknown as VendorDocCorpusDeps['generateEmbedding'],
      },
    );

    expect(deleteFromCorpus).toHaveBeenCalledTimes(1);
    expect(deleteIds).toHaveBeenCalledWith('id', ['corpus-retired']);
    expect(generateEmbedding).not.toHaveBeenCalled();
    expect(result).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 0,
    });
  });

  it('ranks vendor corpus pages with screen-context boost while still surfacing broader semantic matches', async () => {
    const legacyPages: LegacyVendorPage[] = [
      {
        id: 'vendor-page-1',
        app: 'hubspot',
        screen: 'deals',
        content: '# Deals\n\nManage your deal pipeline and stages.',
        source_url: 'https://docs.example.com/deals',
        content_hash: 'hash-deals',
        vendor_source_id: 'source-1',
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
      {
        id: 'vendor-page-2',
        app: 'hubspot',
        screen: 'pipelines',
        content: '# Pipelines\n\nCustomize stages, probabilities, and defaults.',
        source_url: 'https://docs.example.com/pipelines',
        content_hash: 'hash-pipelines',
        vendor_source_id: 'source-1',
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
      {
        id: 'vendor-page-3',
        app: 'hubspot',
        screen: 'contacts',
        content: '# Contacts\n\nManage contact properties.',
        source_url: 'https://docs.example.com/contacts',
        content_hash: 'hash-contacts',
        vendor_source_id: 'source-1',
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
    ];

    const corpusRows: VendorCorpusRow[] = [
      {
        id: 'corpus-deals',
        app: 'hubspot',
        screen: 'deals',
        title: 'Deals',
        normalized_content: 'Manage your deal pipeline and stages.',
        content_excerpt: 'Manage your deal pipeline and stages.',
        source_url: 'https://docs.example.com/deals',
        vendor_page_id: 'vendor-page-1',
        vendor_source_id: 'source-1',
        content_hash: 'hash-deals',
        embedding: [0.82, 0.18],
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
      {
        id: 'corpus-pipelines',
        app: 'hubspot',
        screen: 'pipelines',
        title: 'Pipelines',
        normalized_content: 'Customize stages, probabilities, and defaults.',
        content_excerpt: 'Customize stages, probabilities, and defaults.',
        source_url: 'https://docs.example.com/pipelines',
        vendor_page_id: 'vendor-page-2',
        vendor_source_id: 'source-1',
        content_hash: 'hash-pipelines',
        embedding: [0.95, 0.05],
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
      {
        id: 'corpus-contacts',
        app: 'hubspot',
        screen: 'contacts',
        title: 'Contacts',
        normalized_content: 'Manage contact properties.',
        content_excerpt: 'Manage contact properties.',
        source_url: 'https://docs.example.com/contacts',
        vendor_page_id: 'vendor-page-3',
        vendor_source_id: 'source-1',
        content_hash: 'hash-contacts',
        embedding: [0.1, 0.9],
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-19T00:00:00.000Z',
      },
    ];

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'vendor_wiki_pages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({
              data: legacyPages,
              error: null,
            })),
          };
        }

        if (table === 'vendor_corpus_pages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(async () => ({
              data: corpusRows,
              error: null,
            })),
            delete: jest.fn().mockReturnThis(),
            in: jest.fn(async () => ({ error: null })),
            upsert: jest.fn(async () => ({ error: null })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const results = await resolveVendorCorpusPages(
      {
        app: 'hubspot',
        screen: 'deals',
        question: 'How do I configure deal stages and pipeline defaults?',
        questionEmbedding: [0.98, 0.02],
        limit: 2,
      },
      {
        supabase: supabase as unknown as VendorDocCorpusDeps['supabase'],
      },
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(
      expect.objectContaining({
        id: 'corpus-deals',
        screen: 'deals',
      }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({
        id: 'corpus-pipelines',
        screen: 'pipelines',
      }),
    );
    expect(results[0]!.confidence).toBeGreaterThan(results[1]!.confidence);
  });
});

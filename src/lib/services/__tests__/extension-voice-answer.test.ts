import { describe, expect, it } from '@jest/globals';

import { parseExtensionVoiceAnswer } from '../extension-voice-answer';
import type { CompiledMemoryAnswerContext } from '../compiled-memory-answer-context';

const emptyFreshness = {
  updatedAt: null,
  lastSuccessfulSyncAt: null,
  freshnessTarget: null,
  isStale: null,
};

const emptyProvenance = {
  pageId: 'page-1',
  vendorPageId: null,
  vendorSourceId: null,
  sourceKind: null,
  sourceUrl: null,
};

function buildContext(
  sources: CompiledMemoryAnswerContext['sources'],
): Pick<CompiledMemoryAnswerContext, 'citationsBySourceId' | 'sources'> {
  return {
    sources,
    citationsBySourceId: Object.fromEntries(
      sources.map((source) => [
        source.sourceId,
        {
          citationNumber: source.citationNumber,
          sourceId: source.sourceId,
          title: source.title,
          layer: source.layer,
          excerpt: source.excerpt,
          confidence: source.confidence,
          url: source.url,
          freshness: source.freshness,
          provenance: source.provenance,
          matchType: source.matchType,
        },
      ]),
    ),
  };
}

function source(
  sourceId: string,
  title: string,
  layer: CompiledMemoryAnswerContext['sources'][number]['layer'],
): CompiledMemoryAnswerContext['sources'][number] {
  return {
    citationNumber: 1,
    sourceId,
    title,
    layer,
    content: `${title} content`,
    excerpt: `${title} excerpt`,
    confidence: 0.9,
    url: `https://docs.example.com/${sourceId}`,
    freshness: emptyFreshness,
    provenance: emptyProvenance,
    matchType: 'exact',
  };
}

describe('parseExtensionVoiceAnswer', () => {
  it('strips source and element tags while preserving citations and highlights', () => {
    const answer = parseExtensionVoiceAnswer({
      rawText:
        'Use the team workflow [SOURCE:org-1:Team Billing]. Then click [ELEMENT:div:nth-of-type(2) > button:Approve].',
      answerContext: buildContext([
        source('org-1', 'Team Billing', 'org'),
        source('vendor-1', 'Vendor Billing', 'vendor'),
      ]),
    });

    expect(answer.text).toBe('Use the team workflow. Then click.');
    expect(answer.citations).toEqual([
      {
        sourceId: 'org-1',
        title: 'Team Billing',
        layer: 'org',
        recordingUrl: 'https://docs.example.com/org-1',
      },
    ]);
    expect(answer.elementRefs).toEqual([
      {
        selector: 'div:nth-of-type(2) > button',
        label: 'Approve',
        action: 'highlight',
      },
    ]);
    expect(answer.knowledgeMode).toBe('org_backed');
    expect(answer.sourceCount).toBe(2);
  });

  it('drops unknown source tags and falls back to real compiled-memory sources', () => {
    const answer = parseExtensionVoiceAnswer({
      rawText: 'Trust this fabricated citation [SOURCE:fake:Made Up].',
      answerContext: buildContext([source('org-1', 'Team Billing', 'org')]),
    });

    expect(answer.text).toBe('Trust this fabricated citation.');
    expect(answer.citations).toEqual([
      {
        sourceId: 'org-1',
        title: 'Team Billing',
        layer: 'org',
        recordingUrl: 'https://docs.example.com/org-1',
      },
    ]);
  });

  it('falls back to the first sources when the model omits explicit source tags', () => {
    const answer = parseExtensionVoiceAnswer({
      rawText: 'The visible workflow can be answered from docs.',
      answerContext: buildContext([
        source('vendor-1', 'Vendor Billing', 'vendor'),
        source('training-1', 'Vendor Training', 'vendor_training'),
      ]),
    });

    expect(answer.citations.map((citation) => citation.sourceId)).toEqual([
      'vendor-1',
      'training-1',
    ]);
    expect(answer.knowledgeMode).toBe('vendor_backed');
  });

  it('returns dom_only mode when there are no compiled-memory sources', () => {
    const answer = parseExtensionVoiceAnswer({
      rawText: 'This appears to be the settings page.',
      answerContext: buildContext([]),
    });

    expect(answer.citations).toEqual([]);
    expect(answer.elementRefs).toEqual([]);
    expect(answer.knowledgeMode).toBe('dom_only');
    expect(answer.sourceCount).toBe(0);
  });
});

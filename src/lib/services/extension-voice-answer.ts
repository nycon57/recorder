import type {
  ExtensionVoiceAnswerCitation,
  ExtensionVoiceAnswerElementRef,
  ExtensionVoiceAnswerResponse,
} from '@tribora/shared';
import type { CompiledMemoryAnswerContext } from '@/lib/services/compiled-memory-answer-context';

const ELEMENT_TAG_REGEX = /\[ELEMENT:([^\]]+)\]/gi;
const SOURCE_TAG_REGEX = /\[SOURCE:([^\]]+)\]/gi;

function isSafeTagValue(value: string): boolean {
  return Array.from(value).every((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 && code !== 127 && char !== '[' && char !== ']';
  });
}

function splitElementTagPayload(
  payload: string,
): { selector: string; label: string } | null {
  const separatorIndex = payload.lastIndexOf(':');
  if (separatorIndex <= 0) return null;

  const selector = payload.slice(0, separatorIndex).trim();
  const label = payload.slice(separatorIndex + 1).trim();
  if (!selector || !label) return null;
  if (!isSafeTagValue(selector) || !isSafeTagValue(label)) return null;

  return {
    selector,
    label,
  };
}

function splitSourceTagPayload(
  payload: string,
): { sourceId: string; title: string } | null {
  const separatorIndex = payload.indexOf(':');
  if (separatorIndex <= 0) return null;

  const sourceId = payload.slice(0, separatorIndex).trim();
  const title = payload.slice(separatorIndex + 1).trim();
  if (!sourceId || !title) return null;
  if (!isSafeTagValue(sourceId) || !isSafeTagValue(title)) return null;

  return {
    sourceId,
    title,
  };
}

export function parseExtensionVoiceAnswer(args: {
  rawText: string;
  answerContext: Pick<
    CompiledMemoryAnswerContext,
    'citationsBySourceId' | 'sources'
  >;
}): ExtensionVoiceAnswerResponse {
  const elementRefs: ExtensionVoiceAnswerElementRef[] = [];
  const citations: ExtensionVoiceAnswerCitation[] = [];
  const citedSourceIds = new Set<string>();

  let text = args.rawText.replace(
    ELEMENT_TAG_REGEX,
    (match, payload: string) => {
      const parsed = splitElementTagPayload(payload);
      if (!parsed) return '';
      elementRefs.push({
        selector: parsed.selector,
        label: parsed.label,
        action: 'highlight',
      });
      return '';
    },
  );

  text = text.replace(
    SOURCE_TAG_REGEX,
    (match, payload: string) => {
      const parsed = splitSourceTagPayload(payload);
      if (!parsed) return '';

      const citation = args.answerContext.citationsBySourceId[parsed.sourceId];
      if (!citation) return '';

      if (!citedSourceIds.has(parsed.sourceId)) {
        citedSourceIds.add(parsed.sourceId);
        citations.push({
          sourceId: parsed.sourceId,
          title: parsed.title || citation.title,
          layer: citation.layer,
          recordingUrl: citation.url,
        });
      }
      return '';
    },
  );

  const fallbackCitations = args.answerContext.sources
    .filter((source) => !citedSourceIds.has(source.sourceId))
    .slice(0, 3)
    .map((source) => ({
      sourceId: source.sourceId,
      title: source.title,
      layer: source.layer,
      recordingUrl: source.url,
    }));

  const sourceCount = args.answerContext.sources.length;
  const hasOrgKnowledge = args.answerContext.sources.some(
    (source) => source.layer === 'org',
  );
  const hasVendorKnowledge = args.answerContext.sources.some(
    (source) => source.layer !== 'org',
  );

  return {
    text: text.replace(/\s+([.,!?;:])/g, '$1').replace(/\s+/g, ' ').trim(),
    citations: citations.length > 0 ? citations : fallbackCitations,
    elementRefs,
    knowledgeMode: hasOrgKnowledge
      ? 'org_backed'
      : hasVendorKnowledge
        ? 'vendor_backed'
        : 'dom_only',
    sourceCount,
  };
}

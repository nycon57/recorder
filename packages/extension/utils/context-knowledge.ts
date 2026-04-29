import type { PageContext } from '@tribora/shared';
import {
  buildKnowledgeResolvedFor,
  knowledgeResolvedForContextMatches,
  knowledgeResolvedForEquals,
} from '@tribora/shared';

function hasKnowledgeFields(context: PageContext | undefined): boolean {
  return Boolean(
    context?.vendorKnowledgeMatch ||
      context?.orgKnowledgeMatch ||
      context?.knowledgeAvailability ||
      context?.relevantWikiPages?.length,
  );
}

export function pageContextKnowledgeIdentityChanged(
  previous: PageContext | undefined,
  next: PageContext,
): boolean {
  if (!previous) return false;

  return !knowledgeResolvedForEquals(
    buildKnowledgeResolvedFor(previous),
    buildKnowledgeResolvedFor(next),
  );
}

export function mergePageContextWithPreviousKnowledge(
  previous: PageContext | undefined,
  next: PageContext,
): PageContext {
  const nextKnowledgeApplies =
    hasKnowledgeFields(next) &&
    knowledgeResolvedForContextMatches(next.knowledgeResolvedFor, next);
  const previousKnowledgeApplies =
    hasKnowledgeFields(previous) &&
    knowledgeResolvedForContextMatches(previous?.knowledgeResolvedFor, next);
  const knowledgeSource = nextKnowledgeApplies
    ? next
    : previousKnowledgeApplies
      ? previous
      : null;

  return {
    ...previous,
    ...next,
    vendorKnowledgeMatch: knowledgeSource?.vendorKnowledgeMatch ?? null,
    orgKnowledgeMatch: knowledgeSource?.orgKnowledgeMatch ?? null,
    knowledgeAvailability: knowledgeSource?.knowledgeAvailability,
    relevantWikiPages: knowledgeSource?.relevantWikiPages,
    knowledgeResolvedFor: knowledgeSource?.knowledgeResolvedFor,
  };
}

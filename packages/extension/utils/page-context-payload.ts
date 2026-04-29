import type { PageContext } from '@tribora/shared';
import {
  buildContextSemanticFingerprint,
  sanitizePageContextForModel,
} from '@tribora/shared';

export interface PageContextPayloadMeta {
  repeatedPageContext: boolean;
  unchangedPageContext: boolean;
  bindingEpoch: number;
  pageInstanceId: string | null;
  contentInstanceId: string | null;
}

export function buildPageContextToolPayload(args: {
  context: PageContext;
  meta: PageContextPayloadMeta;
  retrievedAt?: string;
}): {
  result: string;
  fingerprint: string;
  sanitizedContext: PageContext;
} {
  const sanitizedContext = sanitizePageContextForModel(args.context);
  const fingerprint = buildContextSemanticFingerprint(sanitizedContext);

  return {
    fingerprint,
    sanitizedContext,
    result: JSON.stringify({
      ...sanitizedContext,
      appSignature:
        sanitizedContext.appSignature ??
        `${sanitizedContext.app}:${sanitizedContext.screen}`,
      interactiveElements: sanitizedContext.interactiveElements,
      contextMeta: {
        fingerprint,
        repeatedInTurn: args.meta.repeatedPageContext,
        unchangedSinceLastRequest: args.meta.unchangedPageContext,
        guidance: args.meta.unchangedPageContext
          ? 'Page state is unchanged since your last get_page_context call in this turn. Answer once from this context or take a different action. Do not repeat the same answer.'
          : null,
        retrievedAt: args.retrievedAt ?? new Date().toISOString(),
        bindingEpoch: args.meta.bindingEpoch,
        pageInstanceId: args.meta.pageInstanceId,
        contentInstanceId: args.meta.contentInstanceId,
      },
    }),
  };
}

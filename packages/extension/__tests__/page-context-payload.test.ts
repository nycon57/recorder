import { describe, expect, it } from '@jest/globals';
import type { PageContext } from '@tribora/shared';

import { buildPageContextToolPayload } from '../utils/page-context-payload';

function baseContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    app: 'hubspot',
    screen: 'contact-record',
    appSignature: 'hubspot:contact-record',
    url: 'https://user:pass@app.hubspot.com/contacts/123?token=secret#notes',
    title: 'Contact record',
    interactiveElements: [
      {
        selector: '#save',
        label: 'Save',
        type: 'button',
      },
    ],
    ...overrides,
  };
}

describe('page context model payload', () => {
  it('returns minimized get_page_context output for the model', () => {
    const { result } = buildPageContextToolPayload({
      context: baseContext({
        pageSummary:
          'Contact jane@example.com token api_key=super-secret-token visible in page',
        visibleText: 'Raw body with card 4242 4242 4242 4242',
      }),
      retrievedAt: '2026-04-29T12:00:00.000Z',
      meta: {
        repeatedPageContext: false,
        unchangedPageContext: false,
        bindingEpoch: 2,
        pageInstanceId: 'page-1',
        contentInstanceId: 'content-1',
      },
    });

    const payload = JSON.parse(result);
    expect(payload.url).toBe('https://app.hubspot.com/contacts/123');
    expect(payload).not.toHaveProperty('visibleText');
    expect(payload.pageSummary).toBe(
      'Contact [REDACTED] token api_key=[REDACTED] visible in page',
    );
    expect(payload.contextMeta).toMatchObject({
      bindingEpoch: 2,
      pageInstanceId: 'page-1',
      contentInstanceId: 'content-1',
      retrievedAt: '2026-04-29T12:00:00.000Z',
    });
    expect(result).not.toContain('super-secret-token');
    expect(result).not.toContain('4242');
    expect(result).not.toContain('user:pass');
  });
});

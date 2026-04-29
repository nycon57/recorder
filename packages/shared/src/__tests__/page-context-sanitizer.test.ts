import { describe, expect, it } from '@jest/globals';

import type { PageContext } from '../types';
import {
  PAGE_CONTEXT_SANITIZER_LIMITS,
  sanitizePageContextForModel,
  sanitizePageContextForNetwork,
} from '../page-context-sanitizer';

function buildContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    app: 'hubspot',
    screen: 'contact-record',
    appSignature: 'hubspot:contact-record',
    url: 'https://user:pass@app.hubspot.com/contacts/123?token=secret#notes',
    title: 'Contact: jane@example.com',
    interactiveElements: [],
    ...overrides,
  };
}

describe('page context sanitizer', () => {
  it('strips URL query, hash, username, and password', () => {
    const sanitized = sanitizePageContextForNetwork(buildContext());

    expect(sanitized.url).toBe('https://app.hubspot.com/contacts/123');
    expect(sanitized.url).not.toContain('token');
    expect(sanitized.url).not.toContain('user:pass');
    expect(sanitized.url).not.toContain('#notes');
  });

  it('omits visibleText from network and model payloads', () => {
    const fakeSecret = ['sk', 'live', 'secret'].join('_');
    const raw = buildContext({
      visibleText: `Long body text with jane@example.com and ${fakeSecret}`,
    });

    expect(sanitizePageContextForNetwork(raw)).not.toHaveProperty(
      'visibleText',
    );
    expect(sanitizePageContextForModel(raw)).not.toHaveProperty('visibleText');
  });

  it('redacts sensitive tokens and PII in retained labels', () => {
    const fakeSecret = ['sk', 'live', 'abcdefghijkl'].join('_');
    const sanitized = sanitizePageContextForNetwork(
      buildContext({
        pageSummary:
          'Email jane@example.com phone +1 (415) 555-1234 SSN 123-45-6789 card 4242 4242 4242 4242 bearer Bearer abcdefghijklmnop',
        selectedEntity: {
          title: 'API key api_key=secret-token-123',
          subtitle: 'Customer jane@example.com',
        },
        interactiveElements: [
          {
            selector: '#token',
            label: `Secret ${fakeSecret}`,
            type: 'button',
          },
        ],
      }),
    );

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('jane@example.com');
    expect(serialized).not.toContain('415');
    expect(serialized).not.toContain('123-45-6789');
    expect(serialized).not.toContain('4242');
    expect(serialized).not.toContain(fakeSecret);
    expect(serialized).not.toContain('secret-token-123');
    expect(serialized).toContain('[REDACTED]');
  });

  it('caps counts and string lengths while preserving useful fields', () => {
    const sanitized = sanitizePageContextForNetwork(
      buildContext({
        headings: Array.from({ length: 20 }, (_, index) => ({
          level: 2,
          text: `Heading ${index + 1} ${'x'.repeat(200)}`,
          selector: `#heading-${index + 1}`,
        })),
        interactiveElements: Array.from({ length: 80 }, (_, index) => ({
          selector: `#action-${index + 1}`,
          label: `Action ${index + 1}`,
          type: 'button',
        })),
        tables: [
          {
            label: 'Accounts',
            columns: Array.from(
              { length: 30 },
              (_, index) => `Column ${index + 1}`,
            ),
            rowCount: 100,
          },
        ],
        breadcrumbs: Array.from(
          { length: 10 },
          (_, index) => `Crumb ${index + 1}`,
        ),
      }),
    );

    expect(sanitized.headings).toHaveLength(
      PAGE_CONTEXT_SANITIZER_LIMITS.headings,
    );
    expect(sanitized.interactiveElements).toHaveLength(
      PAGE_CONTEXT_SANITIZER_LIMITS.interactiveElements,
    );
    expect(sanitized.tables?.[0]?.columns).toHaveLength(
      PAGE_CONTEXT_SANITIZER_LIMITS.tableColumns,
    );
    expect(sanitized.breadcrumbs).toHaveLength(
      PAGE_CONTEXT_SANITIZER_LIMITS.breadcrumbs,
    );
    expect(sanitized.headings?.[0]?.text.length).toBeLessThanOrEqual(
      PAGE_CONTEXT_SANITIZER_LIMITS.label,
    );
  });

  it('limits form fields to label, selector, type, and required', () => {
    const sanitized = sanitizePageContextForNetwork(
      buildContext({
        forms: [
          {
            label: 'Sensitive form',
            fields: [
              {
                label: 'Password secret@example.com',
                selector: '#password',
                type: 'password',
                required: true,
                valuePresent: true,
                placeholder: 'super-secret',
                disabled: true,
              },
            ],
          },
        ],
      }),
    );

    expect(sanitized.forms?.[0]?.fields[0]).toEqual({
      label: 'Password [REDACTED]',
      selector: '#password',
      type: 'password',
      required: true,
    });
  });

  it('omits sensitive selector values instead of redacting inside CSS locators', () => {
    const uuidSelector =
      '[data-row-id="123e4567-e89b-12d3-a456-426614174000"]';
    const sanitized = sanitizePageContextForNetwork(
      buildContext({
        interactiveElements: [
          {
            selector: 'button[aria-label="Email jane@example.com"]',
            label: 'Email jane@example.com',
            type: 'button',
          },
          {
            selector: '#save',
            label: 'Save',
            type: 'button',
          },
          {
            selector: uuidSelector,
            label: 'Open row',
            type: 'button',
          },
        ],
        forms: [
          {
            label: 'Contact',
            fields: [
              {
                label: 'Email jane@example.com',
                selector: 'input[aria-label="jane@example.com"]',
                type: 'email',
              },
              {
                label: 'Name',
                selector: '#name',
                type: 'text',
              },
            ],
          },
        ],
        vendorKnowledgeMatch: {
          matched: true,
          basis: 'app_signature',
          confidence: 0.8,
          app: 'hubspot',
          screen: 'contact-record',
          pageIds: [],
          selectorHints: [
            'button[aria-label="Email jane@example.com"]',
            '#safe-action',
          ],
        },
      }),
    );

    expect(sanitized.interactiveElements).toEqual([
      expect.objectContaining({
        selector: '#save',
        label: 'Save',
        type: 'button',
      }),
      expect.objectContaining({
        selector: uuidSelector,
        label: 'Open row',
        type: 'button',
      }),
    ]);
    expect(sanitized.forms?.[0]?.fields).toEqual([
      {
        label: 'Name',
        selector: '#name',
        type: 'text',
        required: undefined,
      },
    ]);
    expect(sanitized.vendorKnowledgeMatch?.selectorHints).toEqual([
      '#safe-action',
    ]);

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('jane@example.com');
    expect(serialized).not.toContain('[aria-label="[REDACTED]"]');
  });
});

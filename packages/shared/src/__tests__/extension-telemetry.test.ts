import { describe, expect, it } from '@jest/globals';

import {
  findUnsafeTelemetryField,
  sanitizeExtensionProductTelemetryEvent,
} from '../extension-telemetry';

describe('extension product telemetry sanitizer', () => {
  it('keeps safe product facts and strips unallowlisted metadata', () => {
    const event = sanitizeExtensionProductTelemetryEvent({
      eventId: 'evt_1',
      eventType: 'message_observed',
      occurredAt: '2026-04-29T12:00:00.000Z',
      sessionId: 'session_1',
      seq: 1,
      urlHost: 'Example.COM',
      urlPath: '/contacts/123?token=secret#notes',
      app: 'hubspot',
      screen: 'contact',
      messageDirection: 'user',
      messageLength: 42,
      metadata: {
        lowConfidence: false,
        ignoredFreeform: 'not part of the contract',
      },
    });

    expect(event).toMatchObject({
      eventId: 'evt_1',
      eventType: 'message_observed',
      occurredAt: '2026-04-29T12:00:00.000Z',
      urlHost: 'example.com',
      urlPath: '/contacts/123',
      messageDirection: 'user',
      messageLength: 42,
      metadata: { lowConfidence: false },
    });
    expect(event?.metadata).not.toHaveProperty('ignoredFreeform');
  });

  it.each([
    ['messageText', { messageText: 'raw transcript' }],
    ['question', { question: 'what should I do?' }],
    ['answer', { answer: 'assistant answer text' }],
    ['orgId', { orgId: 'client_org_should_not_be_trusted' }],
    ['actorId', { actorId: 'client_actor_should_not_be_trusted' }],
    ['authMethod', { authMethod: 'api_key' }],
    ['pageText', { pageText: 'full page text' }],
    ['screenshot', { screenshot: 'data:image/png;base64,abc' }],
    ['resultText', { tool: { resultText: 'raw tool output' } }],
  ])('rejects unsafe raw content field %s', (_field, unsafe) => {
    expect(
      sanitizeExtensionProductTelemetryEvent({
        eventId: 'evt_unsafe',
        eventType: 'query',
        occurredAt: '2026-04-29T12:00:00.000Z',
        ...unsafe,
      }),
    ).toBeNull();
  });

  it('finds nested unsafe fields before persistence', () => {
    expect(
      findUnsafeTelemetryField({
        metadata: {
          toolResult: 'raw arbitrary result',
        },
      }),
    ).toBe('toolResult');
  });
});

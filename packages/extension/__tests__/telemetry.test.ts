import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/* global chrome */

const storage = new Map<string, unknown>();
const apiFetch = jest.fn<() => Promise<unknown>>();

jest.mock('../utils/api-client', () => ({
  apiFetch,
}));

beforeEach(() => {
  jest.clearAllMocks();
  storage.clear();
  apiFetch.mockResolvedValue({ ok: true });
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(async (key: string) => ({
          [key]: storage.get(key),
        })),
        set: jest.fn(async (value: Record<string, unknown>) => {
          for (const [key, item] of Object.entries(value)) {
            storage.set(key, item);
          }
        }),
      },
    },
  } as unknown as typeof chrome;
});

describe('extension telemetry queue', () => {
  it('persists safe telemetry and flushes with idempotent event ids', async () => {
    const {
      EXTENSION_TELEMETRY_QUEUE_KEY,
      enqueueExtensionTelemetryEvent,
      flushExtensionTelemetryQueue,
    } = await import('../utils/telemetry');

    await expect(
      enqueueExtensionTelemetryEvent({
        eventId: 'evt_1',
        eventType: 'message_observed',
        occurredAt: '2026-04-29T12:00:00.000Z',
        sessionId: 'session_1',
        seq: 1,
        messageDirection: 'user',
        messageLength: 24,
      }),
    ).resolves.toBe(true);

    expect(storage.get(EXTENSION_TELEMETRY_QUEUE_KEY)).toHaveLength(1);

    await flushExtensionTelemetryQueue();

    expect(apiFetch).toHaveBeenCalledWith('/api/extension/telemetry/events', {
      method: 'POST',
      body: expect.any(String),
    });
    const body = JSON.parse(
      (apiFetch.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(body.events).toEqual([
      expect.objectContaining({
        eventId: 'evt_1',
        eventType: 'message_observed',
      }),
    ]);
    expect(storage.get(EXTENSION_TELEMETRY_QUEUE_KEY)).toEqual([]);
  });

  it('keeps events queued when the network send fails', async () => {
    const {
      EXTENSION_TELEMETRY_QUEUE_KEY,
      enqueueExtensionTelemetryEvent,
      flushExtensionTelemetryQueue,
    } = await import('../utils/telemetry');
    apiFetch.mockRejectedValue(new Error('offline'));

    await enqueueExtensionTelemetryEvent({
      eventId: 'evt_retry',
      eventType: 'sdk_init',
      occurredAt: '2026-04-29T12:00:00.000Z',
    });
    await expect(flushExtensionTelemetryQueue()).rejects.toThrow('offline');

    expect(storage.get(EXTENSION_TELEMETRY_QUEUE_KEY)).toEqual([
      expect.objectContaining({ eventId: 'evt_retry', attempts: 1 }),
    ]);
  });

  it('does not queue unsafe raw telemetry', async () => {
    const {
      EXTENSION_TELEMETRY_QUEUE_KEY,
      enqueueExtensionTelemetryEvent,
    } = await import('../utils/telemetry');

    await expect(
      enqueueExtensionTelemetryEvent({
        eventId: 'evt_unsafe',
        eventType: 'query',
        occurredAt: '2026-04-29T12:00:00.000Z',
        question: 'raw user question',
      } as never),
    ).resolves.toBe(false);

    expect(storage.get(EXTENSION_TELEMETRY_QUEUE_KEY)).toBeUndefined();
  });
});

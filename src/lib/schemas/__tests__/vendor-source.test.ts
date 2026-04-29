import { describe, expect, test } from '@jest/globals';

import { vendorIngestInputSchema, vendorResyncInputSchema } from '../vendor-source';

describe('vendorIngestInputSchema', () => {
  test('accepts valid minimal payload', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'hubspot',
      url: 'https://knowledge.hubspot.com/contacts',
    });
    expect(result.success).toBe(true);
  });

  test('accepts full payload with optional fields', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'stripe',
      url: 'https://docs.stripe.com/api',
      maxPages: 100,
      force: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxPages).toBe(100);
      expect(result.data.force).toBe(true);
    }
  });

  test('rejects empty app', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: '',
      url: 'https://docs.example.com',
    });
    expect(result.success).toBe(false);
  });

  test('rejects app over 64 characters', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'a'.repeat(65),
      url: 'https://docs.example.com',
    });
    expect(result.success).toBe(false);
  });

  test('rejects app with uppercase letters', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'HubSpot',
      url: 'https://docs.hubspot.com',
    });
    expect(result.success).toBe(false);
  });

  test('accepts app with hyphens and underscores', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'my-app_v2',
      url: 'https://docs.example.com',
    });
    expect(result.success).toBe(true);
  });

  test('rejects missing url', () => {
    const result = vendorIngestInputSchema.safeParse({ app: 'hubspot' });
    expect(result.success).toBe(false);
  });

  test('rejects non-http url', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'hubspot',
      url: 'ftp://docs.hubspot.com',
    });
    expect(result.success).toBe(false);
  });

  test('rejects http url', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'hubspot',
      url: 'http://docs.hubspot.com',
    });
    expect(result.success).toBe(false);
  });

  test('rejects invalid url format', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'hubspot',
      url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  test('rejects maxPages below 1', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'hubspot',
      url: 'https://docs.hubspot.com',
      maxPages: 0,
    });
    expect(result.success).toBe(false);
  });

  test('rejects maxPages above 500', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'hubspot',
      url: 'https://docs.hubspot.com',
      maxPages: 501,
    });
    expect(result.success).toBe(false);
  });

  test('rejects fractional maxPages', () => {
    const result = vendorIngestInputSchema.safeParse({
      app: 'hubspot',
      url: 'https://docs.hubspot.com',
      maxPages: 10.5,
    });
    expect(result.success).toBe(false);
  });

  test('accepts maxPages at boundary values', () => {
    expect(
      vendorIngestInputSchema.safeParse({
        app: 'hubspot',
        url: 'https://docs.hubspot.com',
        maxPages: 1,
      }).success,
    ).toBe(true);

    expect(
      vendorIngestInputSchema.safeParse({
        app: 'hubspot',
        url: 'https://docs.hubspot.com',
        maxPages: 500,
      }).success,
    ).toBe(true);
  });
});

describe('vendorResyncInputSchema', () => {
  test('accepts valid UUID sourceId', () => {
    const result = vendorResyncInputSchema.safeParse({
      sourceId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  test('accepts sourceId with optional force', () => {
    const result = vendorResyncInputSchema.safeParse({
      sourceId: '123e4567-e89b-12d3-a456-426614174000',
      force: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.force).toBe(true);
    }
  });

  test('rejects non-UUID sourceId', () => {
    const result = vendorResyncInputSchema.safeParse({
      sourceId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  test('rejects missing sourceId', () => {
    const result = vendorResyncInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

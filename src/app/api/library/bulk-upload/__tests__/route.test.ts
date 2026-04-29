/** @jest-environment node */

import type { NextRequest } from 'next/server';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockRequireOrg = jest.fn();

type MockHandler = (...args: unknown[]) => unknown;

jest.mock('@/lib/utils/api', () => ({
  apiHandler: <THandler extends MockHandler>(fn: THandler) => fn,
  requireOrg: (...args: unknown[]) => mockRequireOrg(...args),
}));

let POST: typeof import('../route').POST;

describe('POST /api/library/bulk-upload', () => {
  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ orgId: 'org_1', userId: 'user_1' });
  });

  it('is retired so it cannot create non-ingesting placeholders', async () => {
    const response = await POST(
      new Request('http://localhost/api/library/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            {
              content_type: 'video',
              title: 'Demo clip',
              file_name: 'demo.webm',
              file_size: 1024,
              mime_type: 'video/webm',
            },
          ],
        }),
      }) as unknown as NextRequest,
    );

    expect(mockRequireOrg).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(410);

    const json = await response.json();
    expect(json).toMatchObject({
      error: 'bulk_upload_deprecated',
      replacement_endpoint: '/api/library/upload',
    });
  });
});

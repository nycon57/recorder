/** @jest-environment node */

import { describe, expect, it, jest } from '@jest/globals';

import { findExactStorageObject } from '../storage-contract';

describe('findExactStorageObject', () => {
  it('searches for the exact object name inside shared content folders', async () => {
    const storageList = jest.fn(() =>
      Promise.resolve({
        data: [
          { name: 'rec_1-copy.mp4' },
          { name: 'rec_1.mp4', metadata: { size: 1024 } },
        ],
        error: null,
      }),
    );
    const storageFrom = jest.fn(() => ({ list: storageList }));

    const result = await findExactStorageObject(
      {
        storage: {
          from: storageFrom,
        },
      },
      'content',
      'org_1/videos/rec_1.mp4',
    );

    expect(storageFrom).toHaveBeenCalledWith('content');
    expect(storageList).toHaveBeenCalledWith('org_1/videos', {
      limit: 10,
      search: 'rec_1.mp4',
    });
    expect(result).toEqual({
      exists: true,
      object: { name: 'rec_1.mp4', metadata: { size: 1024 } },
      error: null,
    });
  });

  it('does not accept partial search matches as object existence', async () => {
    const storageList = jest.fn(() =>
      Promise.resolve({
        data: [{ name: 'rec_1-copy.mp4' }],
        error: null,
      }),
    );

    const result = await findExactStorageObject(
      {
        storage: {
          from: () => ({ list: storageList }),
        },
      },
      'content',
      'org_1/videos/rec_1.mp4',
    );

    expect(result).toEqual({
      exists: false,
      object: null,
      error: null,
    });
  });
});

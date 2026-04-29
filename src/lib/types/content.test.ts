import { describe, expect, it } from '@jest/globals';

import {
  getContentTypeFromMimeType,
  validateFileForUpload,
} from './content';

describe('content upload classification', () => {
  it('keeps WebM as recording by default for recorder flows', () => {
    expect(getContentTypeFromMimeType('video/webm')).toBe('recording');
  });

  it('treats WebM as video for library uploads', () => {
    expect(
      getContentTypeFromMimeType('video/webm', { uploadContext: 'library' }),
    ).toBe('video');
  });

  it('validates WebM as a library video upload', () => {
    const file = new File(['webm bytes'], 'demo.webm', {
      type: 'video/webm',
    });

    expect(validateFileForUpload(file, undefined, { uploadContext: 'library' }))
      .toMatchObject({
        valid: true,
        contentType: 'video',
        fileType: 'webm',
      });
  });
});

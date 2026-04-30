import { describe, expect, it } from '@jest/globals';

import { shouldDeferCompileWikiToWorkflow } from '../docify-google';

describe('shouldDeferCompileWikiToWorkflow', () => {
  it('lets workflow extraction own compile_wiki for recordings when enabled', () => {
    expect(shouldDeferCompileWikiToWorkflow('recording', true)).toBe(true);
  });

  it('lets doc generation queue compile_wiki for recordings when workflow extraction is disabled', () => {
    expect(shouldDeferCompileWikiToWorkflow('recording', false)).toBe(false);
  });

  it('lets doc generation queue compile_wiki for non-recording content', () => {
    expect(shouldDeferCompileWikiToWorkflow('text', true)).toBe(false);
    expect(shouldDeferCompileWikiToWorkflow('document', true)).toBe(false);
    expect(shouldDeferCompileWikiToWorkflow('audio', true)).toBe(false);
    expect(shouldDeferCompileWikiToWorkflow('video', true)).toBe(false);
    expect(shouldDeferCompileWikiToWorkflow(null, true)).toBe(false);
  });
});

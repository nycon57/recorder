/* global describe, expect, it */

import {
  buildLoadingVoiceTargetToolResult,
  buildPageInstanceId,
  buildToolRouteMeta,
  isToolResultCurrent,
  parseToolResultMeta,
} from '../utils/voice-tool-routing';

describe('voice tool routing helpers', () => {
  it('builds stable route metadata for the active binding', () => {
    expect(
      buildToolRouteMeta({
        bindingEpoch: 3,
        targetTabId: 42,
        pageInstanceId: 'content-1:page:2:https://example.com/settings',
        contentInstanceId: 'content-1',
      }),
    ).toEqual({
      bindingEpoch: 3,
      targetTabId: 42,
      pageInstanceId: 'content-1:page:2:https://example.com/settings',
      contentInstanceId: 'content-1',
    });

    expect(
      buildToolRouteMeta({
        bindingEpoch: 3,
        targetTabId: null,
        pageInstanceId: null,
        contentInstanceId: null,
      }),
    ).toBeNull();
  });

  it('rejects stale results from an old binding epoch or page instance', () => {
    const route = {
      bindingEpoch: 5,
      targetTabId: 9,
      pageInstanceId: 'content-1:page:1:https://example.com/a',
      contentInstanceId: 'content-1',
    };

    expect(
      isToolResultCurrent({
        route,
        current: {
          bindingEpoch: 5,
          targetTabId: 9,
          pageInstanceId: route.pageInstanceId,
          contentInstanceId: route.contentInstanceId,
        },
        result: {
          bindingEpoch: 5,
          pageInstanceId: route.pageInstanceId,
          contentInstanceId: route.contentInstanceId,
        },
      }),
    ).toBe(true);

    expect(
      isToolResultCurrent({
        route,
        current: {
          bindingEpoch: 6,
          targetTabId: 9,
          pageInstanceId: route.pageInstanceId,
          contentInstanceId: route.contentInstanceId,
        },
        result: {
          bindingEpoch: 5,
          pageInstanceId: route.pageInstanceId,
          contentInstanceId: route.contentInstanceId,
        },
      }),
    ).toBe(false);

    expect(
      isToolResultCurrent({
        route,
        current: {
          bindingEpoch: 5,
          targetTabId: 9,
          pageInstanceId: 'content-1:page:2:https://example.com/b',
          contentInstanceId: route.contentInstanceId,
        },
        result: {
          bindingEpoch: 5,
          pageInstanceId: 'content-1:page:2:https://example.com/b',
          contentInstanceId: route.contentInstanceId,
        },
      }),
    ).toBe(false);
  });

  it('serializes page instances and controlled loading results', () => {
    expect(
      buildPageInstanceId({
        contentInstanceId: 'abc',
        sequence: 4,
        href: 'https://app.example.com/accounts',
      }),
    ).toBe('abc:page:4:https://app.example.com/accounts');

    expect(
      parseToolResultMeta({
        bindingEpoch: 7,
        pageInstanceId: 'page-1',
        contentInstanceId: 'content-1',
      }),
    ).toEqual({
      bindingEpoch: 7,
      pageInstanceId: 'page-1',
      contentInstanceId: 'content-1',
    });

    expect(buildLoadingVoiceTargetToolResult('get_page_context')).toEqual(
      expect.stringContaining('fresh page context is not available'),
    );
  });
});

/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals';
import type { PageContext } from '@tribora/shared';

import {
  FRAME_SELECTOR_DELIMITER,
  resolveTopDocumentActionTarget,
} from '../entrypoints/content/frame-targeting';

function buildContext(): PageContext {
  return {
    app: 'unknown',
    screen: 'test',
    appSignature: 'unknown:test',
    url: 'https://example.com',
    title: 'Test',
    pageSummary: 'Test page',
    interactiveElements: [
      {
        selector: `#child${FRAME_SELECTOR_DELIMITER}#frame-save`,
        label: 'Save embedded record',
        type: 'button',
        visible: true,
        frameOwner: {
          frameSelector: '#child',
          innerSelector: '#frame-save',
          status: 'same_origin_unsupported',
          frameTitle: 'Embedded CRM',
          frameUrl: 'https://example.com/frame',
        },
      },
    ],
  };
}

describe('frame targeting', () => {
  it('resolves top-document targets normally', () => {
    document.body.innerHTML = '<button id="save">Save</button>';

    const result = resolveTopDocumentActionTarget<HTMLButtonElement>({
      selector: '#save',
      context: buildContext(),
      doc: document,
    });

    expect(result.error).toBeNull();
    expect(result.element).toBeInstanceOf(HTMLButtonElement);
  });

  it('returns a controlled unsupported result for frame-owned targets', () => {
    document.body.innerHTML = '<iframe id="child"></iframe>';

    const result = resolveTopDocumentActionTarget<HTMLButtonElement>({
      selector: `#child${FRAME_SELECTOR_DELIMITER}#save`,
      context: buildContext(),
      doc: document,
    });

    expect(result.element).toBeNull();
    expect(result.error).toContain('target unsupported');
  });

  it('does not hit a top-document lookalike when a frame owns the same inner selector', () => {
    document.body.innerHTML =
      '<button id="frame-save">Save top document</button>';

    const result = resolveTopDocumentActionTarget<HTMLButtonElement>({
      selector: '#frame-save',
      context: buildContext(),
      doc: document,
    });

    expect(result.element).toBeNull();
    expect(result.error).toContain('target unsupported');
    expect(document.querySelector('#frame-save')?.textContent).toBe(
      'Save top document',
    );
  });

  it('does not misclassify ordinary missing selectors as frame targets', () => {
    document.body.innerHTML = '<button id="other">Other</button>';

    const result = resolveTopDocumentActionTarget<HTMLButtonElement>({
      selector: '#missing',
      context: buildContext(),
      doc: document,
    });

    expect(result.element).toBeNull();
    expect(result.error).toBe('target unavailable: element not found');
  });
});

/**
 * @jest-environment jsdom
 */

/* global HTMLCanvasElement, CanvasRenderingContext2D */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createWidget } from '../entrypoints/content/widget';

describe('assistant widget', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({ matches: true })),
    });
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as CanvasRenderingContext2D);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement
      .querySelectorAll('[data-tribora-owner="true"], #tribora-widget-styles')
      .forEach((node) => node.remove());
    jest.restoreAllMocks();
  });

  it('renders the pill as a keyboard-accessible button', () => {
    const onStartClick = jest.fn();
    const widget = createWidget({ onStartClick });

    widget.show();
    const pill = document.querySelector<HTMLButtonElement>('#tribora-widget > button');

    expect(pill).toBeTruthy();
    expect(pill?.type).toBe('button');
    expect(pill?.getAttribute('aria-label')).toBe(
      'Start Tribora voice session',
    );
    expect(pill?.getAttribute('aria-pressed')).toBe('false');

    pill?.click();

    expect(onStartClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the stop button click isolated from the pill start action', () => {
    const onStartClick = jest.fn();
    const onStopClick = jest.fn();
    const widget = createWidget({ onStartClick, onStopClick });

    widget.show();
    widget.setListening();

    const stop = document.querySelector<HTMLButtonElement>(
      '#tribora-widget > button[aria-label="Stop conversation"]',
    );

    stop?.click();

    expect(onStopClick).toHaveBeenCalledTimes(1);
    expect(onStartClick).not.toHaveBeenCalled();
  });
});

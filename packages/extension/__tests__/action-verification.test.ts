/* global describe, expect, it */

import { runVerifiedAction } from '../utils/action-verification';

describe('action verification wording', () => {
  it('marks mutation-only click verification as uncertain', async () => {
    document.body.innerHTML = '<button id="save">Save</button>';
    const button = document.querySelector<HTMLElement>('#save');
    expect(button).toBeTruthy();

    const result = await runVerifiedAction({
      kind: 'click',
      windowObject: window,
      element: button as HTMLElement,
      delayMs: 0,
      action: () => {
        document.body.setAttribute('data-clicked', 'true');
        return 'clicked';
      },
    });

    expect(result).toBe(
      'click uncertain: page changed, but completion was not confirmed',
    );
  });
});

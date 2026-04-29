/* global afterEach, describe, expect, it, jest, KeyboardEvent */

import { requestActionConfirmation } from '../entrypoints/content/action-confirmation';

describe('action confirmation prompt', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement
      .querySelector('#tribora-action-confirmation')
      ?.remove();
    jest.useRealTimers();
  });

  it('returns false when the user declines confirmation', async () => {
    const pageClickSpy = jest.fn();
    document.documentElement.addEventListener('click', pageClickSpy);
    const resultPromise = requestActionConfirmation({
      safety: {
        decision: 'confirm',
        risk: 'destructive',
        reason: 'Requires approval.',
        confirmationLabel: 'Click Delete workspace',
      },
    });

    const dialog = document.querySelector<HTMLElement>(
      '#tribora-action-confirmation',
    );
    expect(dialog).toBeTruthy();
    expect(document.activeElement).toBe(dialog);
    const cancel = Array.from(dialog!.querySelectorAll('button')).find(
      (button) => button.textContent === 'Cancel',
    );
    expect(cancel).toBeTruthy();
    cancel!.click();

    await expect(resultPromise).resolves.toBe(false);
    expect(pageClickSpy).not.toHaveBeenCalled();
    expect(document.querySelector('#tribora-action-confirmation')).toBeNull();
    document.documentElement.removeEventListener('click', pageClickSpy);
  });

  it('keeps handled keyboard events inside the confirmation prompt', async () => {
    const pageKeySpy = jest.fn();
    document.documentElement.addEventListener('keydown', pageKeySpy);
    const resultPromise = requestActionConfirmation({
      safety: {
        decision: 'confirm',
        risk: 'input',
        reason: 'Requires approval.',
        confirmationLabel: 'Press Enter on Submit',
      },
    });

    const dialog = document.querySelector<HTMLElement>(
      '#tribora-action-confirmation',
    );
    expect(dialog).toBeTruthy();
    dialog!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );

    await expect(resultPromise).resolves.toBe(false);
    expect(pageKeySpy).not.toHaveBeenCalled();
    document.documentElement.removeEventListener('keydown', pageKeySpy);
  });

  it('times out safely and does not render raw typed text', async () => {
    jest.useFakeTimers();
    const resultPromise = requestActionConfirmation({
      timeoutMs: 100,
      safety: {
        decision: 'confirm',
        risk: 'input',
        reason: 'Requires approval.',
        confirmationLabel: 'Type 24 characters into Project name',
      },
    });

    expect(document.documentElement.textContent).not.toContain(
      'secret-token-value',
    );
    jest.advanceTimersByTime(100);

    await expect(resultPromise).resolves.toBe(false);
  });
});

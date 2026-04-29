/* global CSSStyleDeclaration, KeyboardEvent */

import { TRIBORA_EXTENSION_THEME } from '../../utils/tribora-theme.js';
import type { ActionSafetyResult } from '../../utils/action-safety-policy.js';

const CONFIRMATION_ID = 'tribora-action-confirmation';
const TIMEOUT_MS = 12_000;
let activeSettle: ((value: boolean) => void) | null = null;

export interface ActionConfirmationPrompt {
  safety: ActionSafetyResult;
  timeoutMs?: number;
}

export function requestActionConfirmation(
  prompt: ActionConfirmationPrompt,
): Promise<boolean> {
  const timeoutMs = prompt.timeoutMs ?? TIMEOUT_MS;
  activeSettle?.(false);

  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.id = CONFIRMATION_ID;
    container.setAttribute('data-tribora-owner', 'true');
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'false');
    container.setAttribute('aria-label', 'Confirm Tribora action');
    apply(container, {
      position: 'fixed',
      right: '20px',
      bottom: '78px',
      zIndex: '2147483647',
      width: 'min(340px, calc(100vw - 32px))',
      padding: '12px',
      borderRadius: '8px',
      background: TRIBORA_EXTENSION_THEME.color.surface1,
      color: TRIBORA_EXTENSION_THEME.color.ink,
      border: `1px solid ${TRIBORA_EXTENSION_THEME.color.lineStrong}`,
      boxShadow: '0 18px 44px rgba(0, 0, 0, 0.44)',
      fontFamily: TRIBORA_EXTENSION_THEME.font.body,
      pointerEvents: 'auto',
    });

    const title = document.createElement('div');
    title.textContent = 'Approve action?';
    apply(title, {
      fontSize: '13px',
      lineHeight: '18px',
      fontWeight: '700',
      marginBottom: '4px',
    });

    const action = document.createElement('div');
    action.textContent =
      prompt.safety.confirmationLabel ?? 'Run the requested browser action';
    apply(action, {
      fontSize: '12px',
      lineHeight: '17px',
      color: TRIBORA_EXTENSION_THEME.color.inkMuted,
      marginBottom: '10px',
      overflowWrap: 'anywhere',
    });

    const controls = document.createElement('div');
    apply(controls, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '8px',
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    applyButton(cancel, 'secondary');

    const approve = document.createElement('button');
    approve.type = 'button';
    approve.textContent = 'Approve';
    applyButton(approve, 'primary');

    controls.append(cancel, approve);
    container.append(title, action, controls);
    document.documentElement.appendChild(container);

    let settled = false;
    const timer = window.setTimeout(() => settle(false), timeoutMs);

    function settle(value: boolean): void {
      if (settled) return;
      settled = true;
      if (activeSettle === settle) activeSettle = null;
      window.clearTimeout(timer);
      container.removeEventListener('keydown', onKeyDown);
      container.remove();
      resolve(value);
    }

    activeSettle = settle;

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(false);
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === approve) {
        event.preventDefault();
        settle(true);
      }
    }

    cancel.addEventListener('click', () => settle(false));
    approve.addEventListener('click', () => settle(true));
    container.addEventListener('keydown', onKeyDown);
    approve.focus();
  });
}

function apply(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

function applyButton(
  button: HTMLButtonElement,
  variant: 'primary' | 'secondary',
): void {
  const isPrimary = variant === 'primary';
  apply(button, {
    border: `1px solid ${
      isPrimary
        ? TRIBORA_EXTENSION_THEME.color.signalEdge
        : TRIBORA_EXTENSION_THEME.color.lineStrong
    }`,
    borderRadius: '6px',
    background: isPrimary
      ? TRIBORA_EXTENSION_THEME.color.signal
      : TRIBORA_EXTENSION_THEME.color.surface2,
    color: isPrimary
      ? TRIBORA_EXTENSION_THEME.color.signalInk
      : TRIBORA_EXTENSION_THEME.color.ink,
    cursor: 'pointer',
    fontFamily: TRIBORA_EXTENSION_THEME.font.body,
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: '16px',
    padding: '6px 10px',
  });
}

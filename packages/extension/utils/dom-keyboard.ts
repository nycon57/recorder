import { clickElement } from './dom-actions.js';

type SupportedModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';

export interface PressKeyArgs {
  key: string;
  target?: HTMLElement | null;
  modifiers?: string[];
  repeat?: number;
}

interface NormalizedKeyPress {
  key: string;
  modifiers: SupportedModifier[];
  repeat: number;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function toModifier(token: string): SupportedModifier | null {
  switch (token.trim().toLowerCase()) {
    case 'alt':
    case 'option':
      return 'Alt';
    case 'cmd':
    case 'command':
    case 'meta':
      return 'Meta';
    case 'ctrl':
    case 'control':
      return 'Control';
    case 'shift':
      return 'Shift';
    default:
      return null;
  }
}

function normalizeKeyPress(args: PressKeyArgs): NormalizedKeyPress {
  const rawParts = args.key
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  const keyPart = rawParts.pop() ?? args.key;
  const modifierParts = [...rawParts, ...(args.modifiers ?? [])];
  const modifiers = Array.from(
    new Set(
      modifierParts
        .map((modifier) => toModifier(modifier))
        .filter((modifier): modifier is SupportedModifier => modifier !== null),
    ),
  );

  return {
    key: keyPart,
    modifiers,
    repeat: Math.max(1, Math.floor(args.repeat ?? 1)),
  };
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return true;
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  return true;
}

function getFocusableElements(documentObject: Document): HTMLElement[] {
  return Array.from(
    documentObject.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => isVisible(element));
}

function keyToCode(key: string): string {
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (/[A-Z]/.test(upper)) return `Key${upper}`;
    if (/[0-9]/.test(key)) return `Digit${key}`;
  }

  switch (key) {
    case ' ':
    case 'Space':
    case 'Spacebar':
      return 'Space';
    default:
      return key;
  }
}

function dispatchKeyboardEvent(
  target: EventTarget,
  type: 'keydown' | 'keypress' | 'keyup',
  args: NormalizedKeyPress,
): boolean {
  const event = new KeyboardEvent(type, {
    key: args.key,
    code: keyToCode(args.key),
    bubbles: true,
    cancelable: true,
    altKey: args.modifiers.includes('Alt'),
    ctrlKey: args.modifiers.includes('Control'),
    metaKey: args.modifiers.includes('Meta'),
    shiftKey: args.modifiers.includes('Shift'),
  });
  return target.dispatchEvent(event);
}

function moveFocusByTab(current: HTMLElement, backwards: boolean): void {
  const focusables = getFocusableElements(current.ownerDocument);
  if (focusables.length === 0) return;

  const currentIndex = Math.max(0, focusables.indexOf(current));
  const delta = backwards ? -1 : 1;
  const nextIndex =
    (currentIndex + delta + focusables.length) % focusables.length;
  focusables[nextIndex]?.focus();
}

function moveSelectOption(target: HTMLSelectElement, delta: number): void {
  const nextIndex = Math.min(
    Math.max(target.selectedIndex + delta, 0),
    target.options.length - 1,
  );
  if (nextIndex === target.selectedIndex) return;

  target.selectedIndex = nextIndex;
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyDefaultBehavior(target: HTMLElement, args: NormalizedKeyPress) {
  const normalizedKey = args.key === 'Spacebar' ? 'Space' : args.key;

  if (normalizedKey === 'Tab') {
    moveFocusByTab(target, args.modifiers.includes('Shift'));
    return;
  }

  if (target instanceof HTMLSelectElement) {
    if (normalizedKey === 'ArrowDown') {
      moveSelectOption(target, 1);
      return;
    }
    if (normalizedKey === 'ArrowUp') {
      moveSelectOption(target, -1);
      return;
    }
  }

  if (
    normalizedKey === 'Enter' ||
    normalizedKey === ' ' ||
    normalizedKey === 'Space'
  ) {
    if (
      target.matches('button, a[href], [role="button"]') ||
      (target instanceof HTMLInputElement &&
        ['checkbox', 'radio', 'button', 'submit'].includes(target.type))
    ) {
      clickElement(target);
    }
  }
}

export function pressKey(args: PressKeyArgs): string {
  const normalized = normalizeKeyPress(args);
  const documentObject = args.target?.ownerDocument ?? document;
  const initialTarget =
    args.target ??
    (documentObject.activeElement instanceof HTMLElement
      ? documentObject.activeElement
      : documentObject.body);

  if (
    initialTarget instanceof HTMLElement &&
    documentObject.activeElement !== initialTarget
  ) {
    initialTarget.focus();
  }

  for (let index = 0; index < normalized.repeat; index += 1) {
    const target =
      (documentObject.activeElement as HTMLElement | null) ?? initialTarget;
    const proceed = dispatchKeyboardEvent(target, 'keydown', normalized);
    if (proceed) {
      if (
        normalized.key.length === 1 ||
        normalized.key === 'Enter' ||
        normalized.key === 'Space' ||
        normalized.key === ' '
      ) {
        dispatchKeyboardEvent(target, 'keypress', normalized);
      }
      applyDefaultBehavior(target, normalized);
    }
    dispatchKeyboardEvent(target, 'keyup', normalized);
  }

  const combo = [...normalized.modifiers, normalized.key].join('+');
  return `pressed ${combo}`;
}

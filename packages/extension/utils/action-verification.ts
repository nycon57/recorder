/* global Window */

type VerifiedActionKind = 'click' | 'hover' | 'type' | 'scroll' | 'keyboard';

interface ElementSnapshot {
  connected: boolean;
  visible: boolean;
  value: string | null;
  checked: boolean | null;
  active: boolean;
  ariaExpanded: string | null;
  ariaPressed: string | null;
  ariaSelected: string | null;
  rect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  } | null;
}

function isVisible(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return true;
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function snapshotElement(element: HTMLElement): ElementSnapshot {
  const doc = element.ownerDocument;
  const rect = element.getBoundingClientRect();
  return {
    connected: element.isConnected,
    visible: isVisible(element),
    value:
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
        ? element.value
        : element.getAttribute('contenteditable') !== null
          ? (element.textContent ?? '')
          : null,
    checked:
      element instanceof HTMLInputElement &&
      (element.type === 'checkbox' || element.type === 'radio')
        ? element.checked
        : null,
    active: doc.activeElement === element,
    ariaExpanded: element.getAttribute('aria-expanded'),
    ariaPressed: element.getAttribute('aria-pressed'),
    ariaSelected: element.getAttribute('aria-selected'),
    rect:
      Number.isFinite(rect.top) &&
      Number.isFinite(rect.bottom) &&
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.right)
        ? {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          }
        : null,
  };
}

function wait(windowObject: Window, delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    windowObject.setTimeout(() => resolve(), delayMs);
  });
}

function describeClickOutcome(
  before: ElementSnapshot,
  after: ElementSnapshot,
  mutationCount: number,
  beforeUrl: string,
  afterUrl: string,
): string {
  if (beforeUrl !== afterUrl) {
    return `clicked (verified: navigated to ${afterUrl})`;
  }
  if (before.checked !== after.checked && after.checked !== null) {
    return 'clicked (verified: selection state changed)';
  }
  if (
    before.ariaExpanded !== after.ariaExpanded &&
    after.ariaExpanded !== null
  ) {
    return `clicked (verified: expanded state changed to ${after.ariaExpanded})`;
  }
  if (before.ariaPressed !== after.ariaPressed && after.ariaPressed !== null) {
    return `clicked (verified: pressed state changed to ${after.ariaPressed})`;
  }
  if (
    before.ariaSelected !== after.ariaSelected &&
    after.ariaSelected !== null
  ) {
    return `clicked (verified: selected state changed to ${after.ariaSelected})`;
  }
  if (before.connected && !after.connected) {
    return 'clicked (verified: target disappeared from the page)';
  }
  if (before.visible && !after.visible) {
    return 'clicked (verified: target became hidden)';
  }
  if (mutationCount > 0) {
    return 'click uncertain: page changed, but completion was not confirmed';
  }
  if (!before.active && after.active) {
    return 'click uncertain: target gained focus, but completion was not confirmed';
  }
  return 'click may not have taken effect: no visible UI change detected after 250ms';
}

function describeHoverOutcome(
  before: ElementSnapshot,
  after: ElementSnapshot,
  mutationCount: number,
): string {
  if (
    before.ariaExpanded !== after.ariaExpanded &&
    after.ariaExpanded !== null
  ) {
    return `hovered (verified: expanded state changed to ${after.ariaExpanded})`;
  }
  if (mutationCount > 0) {
    return 'hover uncertain: page changed, but the target state was not confirmed';
  }
  return 'hover may not have revealed anything: no visible UI change detected after 250ms';
}

function describeTypeOutcome(
  before: ElementSnapshot,
  after: ElementSnapshot,
  mutationCount: number,
): string {
  if (before.value !== after.value && after.value !== null) {
    return 'typed (verified: field value updated)';
  }
  if (mutationCount > 0) {
    return 'type uncertain: page changed, but the field value was not confirmed';
  }
  return 'typed (warning: field value did not change after 250ms)';
}

function describeScrollOutcome(
  after: ElementSnapshot,
  viewportHeight: number,
  viewportWidth: number,
): string {
  if (
    after.rect &&
    after.rect.top < viewportHeight &&
    after.rect.bottom > 0 &&
    after.rect.left < viewportWidth &&
    after.rect.right > 0
  ) {
    return 'scrolled (verified: target is in view)';
  }
  return 'scrolled (warning: target may still be out of view)';
}

function describeKeyboardOutcome(args: {
  before: ElementSnapshot;
  after: ElementSnapshot;
  mutationCount: number;
  beforeUrl: string;
  afterUrl: string;
  beforeActiveElement: Element | null;
  afterActiveElement: Element | null;
  actionLabel: string;
}): string {
  if (args.beforeUrl !== args.afterUrl) {
    return `pressed ${args.actionLabel} (verified: navigated to ${args.afterUrl})`;
  }
  if (
    args.beforeActiveElement !== args.afterActiveElement &&
    args.afterActiveElement instanceof HTMLElement
  ) {
    const label =
      args.afterActiveElement.getAttribute('aria-label') ||
      (args.afterActiveElement instanceof HTMLInputElement
        ? args.afterActiveElement.name || args.afterActiveElement.id
        : args.afterActiveElement.textContent?.trim()) ||
      args.afterActiveElement.id ||
      args.afterActiveElement.tagName.toLowerCase();
    return `pressed ${args.actionLabel} (verified: focus moved to ${label})`;
  }
  if (
    args.before.checked !== args.after.checked &&
    args.after.checked !== null
  ) {
    return `pressed ${args.actionLabel} (verified: selection state changed)`;
  }
  if (args.before.value !== args.after.value && args.after.value !== null) {
    return `pressed ${args.actionLabel} (verified: field value changed)`;
  }
  if (args.mutationCount > 0) {
    return `pressed ${args.actionLabel} (uncertain: page changed, but completion was not confirmed)`;
  }
  return `pressed ${args.actionLabel} (warning: no visible UI change detected after 250ms)`;
}

export async function runVerifiedAction(args: {
  kind: VerifiedActionKind;
  windowObject: Window;
  element: HTMLElement;
  action: () => string;
  delayMs?: number;
  actionLabel?: string;
}): Promise<string> {
  const beforeUrl = args.windowObject.location.href;
  const before = snapshotElement(args.element);
  const beforeActiveElement = args.windowObject.document.activeElement;
  let mutationCount = 0;
  const observer = new args.windowObject.MutationObserver((records) => {
    mutationCount += records.length;
  });
  observer.observe(args.windowObject.document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  const baseResult = args.action();
  if (
    baseResult === 'element not found' ||
    baseResult.startsWith('target unavailable') ||
    baseResult.startsWith('failed') ||
    baseResult === 'element is not an input field'
  ) {
    observer.disconnect();
    return baseResult;
  }

  await wait(args.windowObject, args.delayMs ?? 250);
  observer.disconnect();

  const after = snapshotElement(args.element);
  const afterUrl = args.windowObject.location.href;
  const afterActiveElement = args.windowObject.document.activeElement;

  switch (args.kind) {
    case 'click':
      return describeClickOutcome(
        before,
        after,
        mutationCount,
        beforeUrl,
        afterUrl,
      );
    case 'hover':
      return describeHoverOutcome(before, after, mutationCount);
    case 'type':
      return describeTypeOutcome(before, after, mutationCount);
    case 'scroll':
      return describeScrollOutcome(
        after,
        args.windowObject.innerHeight || 768,
        args.windowObject.innerWidth || 1024,
      );
    case 'keyboard':
      return describeKeyboardOutcome({
        before,
        after,
        mutationCount,
        beforeUrl,
        afterUrl,
        beforeActiveElement,
        afterActiveElement,
        actionLabel: args.actionLabel ?? 'key',
      });
    default:
      return baseResult;
  }
}

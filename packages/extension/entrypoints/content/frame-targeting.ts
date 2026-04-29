import type { InteractiveElement, PageContext } from '@tribora/shared';

/* global Document */

export const FRAME_SELECTOR_DELIMITER = ' >>frame>> ';

export function buildFrameOwnedSelector(args: {
  frameSelector: string;
  innerSelector: string;
}): string {
  return `${args.frameSelector}${FRAME_SELECTOR_DELIMITER}${args.innerSelector}`;
}

export function findFrameOwnedContextElement(
  selector: string,
  context: PageContext | null | undefined,
): InteractiveElement | null {
  if (!selector || !context) return null;

  return (
    context.interactiveElements.find(
      (element) =>
        element.frameOwner &&
        (element.selector === selector ||
          element.frameOwner.innerSelector === selector),
    ) ?? null
  );
}

export function getUnsupportedFrameTargetMessage(
  element: InteractiveElement,
): string {
  const frameLabel =
    element.frameOwner?.frameTitle ||
    element.frameOwner?.frameUrl ||
    element.frameOwner?.frameSelector ||
    'iframe';
  const targetLabel = element.label || element.frameOwner?.innerSelector;

  return `target unsupported: "${targetLabel}" is inside ${frameLabel}. Frame-owned elements are visible in context but cannot be safely acted on by this tool yet.`;
}

export function resolveTopDocumentActionTarget<T extends HTMLElement>(args: {
  selector: string;
  context: PageContext | null | undefined;
  doc?: Document;
}): { element: T | null; error: string | null } {
  if (args.selector.includes(FRAME_SELECTOR_DELIMITER)) {
    const frameOwned = findFrameOwnedContextElement(
      args.selector,
      args.context,
    );
    return {
      element: null,
      error: frameOwned
        ? getUnsupportedFrameTargetMessage(frameOwned)
        : 'target unsupported: selector points inside an iframe. Frame-owned elements are visible in context but cannot be safely acted on by this tool yet.',
    };
  }

  let element: T | null = null;
  try {
    element = (args.doc ?? document).querySelector<T>(args.selector);
  } catch {
    return { element: null, error: 'target unavailable: invalid selector' };
  }

  const frameOwned = findFrameOwnedContextElement(args.selector, args.context);
  if (frameOwned) {
    return {
      element: null,
      error: getUnsupportedFrameTargetMessage(frameOwned),
    };
  }

  if (!element) {
    return { element: null, error: 'target unavailable: element not found' };
  }

  return { element, error: null };
}

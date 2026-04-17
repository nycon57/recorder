export function scrollElementIntoView(element: Element): string {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return 'scrolled';
}

function dispatchMouseLikeEvent(
  element: HTMLElement,
  type: string,
  options: Record<string, unknown> = {},
): void {
  const view = element.ownerDocument.defaultView;
  const baseOptions = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: 0,
    clientY: 0,
    ...options,
  };

  if (view?.PointerEvent && type.startsWith('pointer')) {
    element.dispatchEvent(
      new view.PointerEvent(type, {
        ...baseOptions,
        pointerType: 'mouse',
        isPrimary: true,
      }),
    );
    return;
  }

  if (view?.MouseEvent) {
    element.dispatchEvent(new view.MouseEvent(type, baseOptions));
    return;
  }

  element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

export function hoverElement(element: HTMLElement): string {
  dispatchMouseLikeEvent(element, 'pointerover');
  dispatchMouseLikeEvent(element, 'pointerenter');
  dispatchMouseLikeEvent(element, 'mouseover');
  dispatchMouseLikeEvent(element, 'mouseenter');
  dispatchMouseLikeEvent(element, 'pointermove');
  dispatchMouseLikeEvent(element, 'mousemove');
  return 'hovered';
}

export function clickElement(element: HTMLElement): string {
  hoverElement(element);
  element.focus();
  dispatchMouseLikeEvent(element, 'pointerdown', { buttons: 1 });
  dispatchMouseLikeEvent(element, 'mousedown', { buttons: 1 });
  dispatchMouseLikeEvent(element, 'pointerup');
  dispatchMouseLikeEvent(element, 'mouseup');
  element.click();
  return 'clicked';
}

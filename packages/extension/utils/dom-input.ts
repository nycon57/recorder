export interface TypeIntoElementArgs {
  text: string;
  clear?: boolean;
}

function isContentEditableElement(element: HTMLElement): boolean {
  return (
    element.isContentEditable ||
    element.getAttribute('contenteditable') === 'true' ||
    element.getAttribute('contenteditable') === ''
  );
}

function dispatchBubbledEvent(target: HTMLElement, event: Event): void {
  target.dispatchEvent(event);
}

function dispatchInputLifecycle(
  target: HTMLElement,
  insertedText: string,
): void {
  const view = target.ownerDocument.defaultView;

  if (view?.InputEvent) {
    dispatchBubbledEvent(
      target,
      new view.InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: insertedText,
        inputType: 'insertText',
      }),
    );
  }

  if (view?.KeyboardEvent) {
    dispatchBubbledEvent(
      target,
      new view.KeyboardEvent('keydown', {
        bubbles: true,
        key: insertedText.slice(-1) || 'Unidentified',
      }),
    );
  }

  dispatchBubbledEvent(target, new Event('input', { bubbles: true }));

  if (view?.KeyboardEvent) {
    dispatchBubbledEvent(
      target,
      new view.KeyboardEvent('keyup', {
        bubbles: true,
        key: insertedText.slice(-1) || 'Unidentified',
      }),
    );
  }

  dispatchBubbledEvent(target, new Event('change', { bubbles: true }));
}

function setNativeTextValue(
  target: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string,
): void {
  const view = target.ownerDocument.defaultView;
  const prototype =
    target instanceof view!.HTMLTextAreaElement
      ? view!.HTMLTextAreaElement.prototype
      : view!.HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(target, nextValue);
    return;
  }

  target.value = nextValue;
}

function setNativeSelectValue(
  target: HTMLSelectElement,
  nextValue: string,
): void {
  const view = target.ownerDocument.defaultView;
  const descriptor = Object.getOwnPropertyDescriptor(
    view!.HTMLSelectElement.prototype,
    'value',
  );
  if (descriptor?.set) {
    descriptor.set.call(target, nextValue);
    return;
  }

  target.value = nextValue;
}

function findMatchingOption(
  target: HTMLSelectElement,
  text: string,
): HTMLOptionElement | null {
  const normalized = text.trim().toLowerCase();
  return (
    Array.from(target.options).find((option) => {
      return (
        option.value.trim().toLowerCase() === normalized ||
        option.label.trim().toLowerCase() === normalized ||
        option.text.trim().toLowerCase() === normalized
      );
    }) ?? null
  );
}

export function typeIntoElement(
  element: HTMLElement,
  args: TypeIntoElementArgs,
): string {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const nextValue = `${args.clear ? '' : element.value}${args.text}`;
    setNativeTextValue(element, nextValue);
    dispatchInputLifecycle(element, args.text);
    if (element.value !== nextValue) {
      return 'failed to type text into input field';
    }
    return 'typed';
  }

  if (element instanceof HTMLSelectElement) {
    const option = findMatchingOption(element, args.text);
    if (!option) {
      return 'failed to find matching option in select field';
    }

    setNativeSelectValue(element, option.value);
    dispatchInputLifecycle(element, option.value);
    if (element.value !== option.value) {
      return 'failed to select option in select field';
    }
    return 'selected';
  }

  if (isContentEditableElement(element)) {
    const nextValue = `${args.clear ? '' : (element.textContent ?? '')}${args.text}`;
    element.textContent = nextValue;
    dispatchInputLifecycle(element, args.text);
    if ((element.textContent ?? '') !== nextValue) {
      return 'failed to type text into contenteditable field';
    }
    return 'typed';
  }

  return 'element is not an input field';
}

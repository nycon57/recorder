/* global HTMLLabelElement */

export type BrowserToolName =
  | 'get_page_context'
  | 'search_page_elements'
  | 'inspect_element'
  | 'inspect_page_region'
  | 'highlight_element'
  | 'highlight_elements'
  | 'hover_element'
  | 'scroll_to_element'
  | 'click_element'
  | 'type_in_element'
  | 'press_key';

export type ActionSafetyDecision = 'allow' | 'confirm' | 'block';

export type ActionSafetyRisk =
  | 'read'
  | 'navigation'
  | 'input'
  | 'destructive'
  | 'sensitive'
  | 'shortcut'
  | 'target';

export interface ActionSafetyResult {
  decision: ActionSafetyDecision;
  risk: ActionSafetyRisk;
  reason: string;
  confirmationLabel?: string;
  targetLabel?: string;
}

export interface ActionSafetyArgs {
  toolName: BrowserToolName;
  target?: HTMLElement | null;
  selector?: string;
  text?: string;
  clear?: boolean;
  key?: string;
  modifiers?: string[];
  repeat?: number;
}

const READ_ONLY_TOOLS = new Set<BrowserToolName>([
  'get_page_context',
  'search_page_elements',
  'inspect_element',
  'inspect_page_region',
  'highlight_element',
  'highlight_elements',
  'hover_element',
  'scroll_to_element',
]);

const DESTRUCTIVE_LABEL_PATTERN =
  /\b(delete|remove|destroy|discard|archive|trash|submit|send|publish|share|purchase|buy|pay|checkout|save|create|invite|approve|confirm|disconnect|revoke|reset|cancel subscription|bulk|merge|transfer|launch|connect)\b/i;

const SENSITIVE_FIELD_PATTERN =
  /\b(password|passcode|secret|token|api[-_\s]*key|private[-_\s]*key|access[-_\s]*key|bearer|credit[-_\s]*card|card[-_\s]*(number|code)|cc-number|cvv|cvc|ssn|social[-_\s]*security|mfa|otp|one[-_\s]*time|2fa|two[-_\s]*factor|auth(entication)?[-_\s]*code|security[-_\s]*code)\b/i;

const SENSITIVE_TEXT_PATTERN =
  /\b(?:bearer\s+[a-z0-9._~+/=-]{12,}|sk_(?:live|test)_[a-z0-9_]{8,}|pk_(?:live|test)_[a-z0-9_]{8,}|api[-_\s]*key\s*[:=]\s*\S{6,}|\d{3}-\d{2}-\d{4}|\d(?:[ -]?\d){13,18}|\d{6})\b/i;

const MUTATING_KEY_PATTERN =
  /^(enter|space|spacebar|backspace|delete|del|escape)$/i;

const DANGEROUS_SHORTCUTS = new Set([
  'Meta+L',
  'Meta+R',
  'Meta+W',
  'Meta+Q',
  'Meta+T',
  'Meta+N',
  'Meta+S',
  'Meta+Enter',
  'Meta+Shift+W',
  'Meta+Shift+R',
  'Control+L',
  'Control+R',
  'Control+W',
  'Control+T',
  'Control+N',
  'Control+S',
  'Control+Enter',
  'Control+Shift+W',
  'Control+Shift+R',
  'Alt+ArrowLeft',
  'Alt+ArrowRight',
  'F5',
]);

export function classifyBrowserAction(
  args: ActionSafetyArgs,
): ActionSafetyResult {
  if (READ_ONLY_TOOLS.has(args.toolName)) {
    return {
      decision: 'allow',
      risk: 'read',
      reason: 'Read-only teaching action.',
    };
  }

  const target = args.target ?? null;
  if (!target) {
    return {
      decision: 'block',
      risk: 'target',
      reason: 'Action blocked: target element is unavailable.',
    };
  }

  const targetIssue = getUnsafeTargetReason(target);
  if (targetIssue) {
    return {
      decision: 'block',
      risk: targetIssue.risk,
      reason: targetIssue.reason,
      targetLabel: describeTarget(target, args.selector),
    };
  }

  const targetLabel = describeTarget(target, args.selector);

  if (args.toolName === 'type_in_element') {
    if (textLooksSensitive(args.text)) {
      return {
        decision: 'block',
        risk: 'sensitive',
        reason: 'Action blocked: typed text appears sensitive.',
        targetLabel,
      };
    }

    if (isSensitiveTypingTarget(target)) {
      return {
        decision: 'block',
        risk: 'sensitive',
        reason: 'Action blocked: target appears to collect sensitive input.',
        targetLabel,
      };
    }

    return {
      decision: 'confirm',
      risk: 'input',
      reason: 'Typing changes page data and requires approval.',
      confirmationLabel: `Type ${String(args.text ?? '').length} characters into ${targetLabel}`,
      targetLabel,
    };
  }

  if (args.toolName === 'press_key') {
    const keyPress = normalizeKeyPress(args);
    const shortcut = formatShortcut(keyPress.modifiers, keyPress.key);
    if ((args.repeat ?? 1) > 8) {
      return {
        decision: 'block',
        risk: 'shortcut',
        reason: 'Action blocked: repeated key press exceeds the safety cap.',
        confirmationLabel: shortcut,
        targetLabel,
      };
    }
    if (DANGEROUS_SHORTCUTS.has(shortcut)) {
      return {
        decision: 'block',
        risk: 'shortcut',
        reason: `Action blocked: ${shortcut} is a browser or system shortcut.`,
        confirmationLabel: shortcut,
        targetLabel,
      };
    }
    if (isSensitiveTypingTarget(target) && keyCanEditText(keyPress.key)) {
      return {
        decision: 'block',
        risk: 'sensitive',
        reason: 'Action blocked: target appears to collect sensitive input.',
        confirmationLabel: shortcut,
        targetLabel,
      };
    }

    const risk: ActionSafetyRisk =
      MUTATING_KEY_PATTERN.test(keyPress.key) || targetTextIsDestructive(target)
        ? 'destructive'
        : 'input';

    return {
      decision: 'confirm',
      risk,
      reason: 'Keyboard actions can change page state and require approval.',
      confirmationLabel: `Press ${shortcut} on ${targetLabel}`,
      targetLabel,
    };
  }

  if (args.toolName === 'click_element') {
    const risk: ActionSafetyRisk = targetTextIsDestructive(target)
      ? 'destructive'
      : clickMayNavigate(target)
        ? 'navigation'
        : 'input';

    return {
      decision: 'confirm',
      risk,
      reason:
        risk === 'destructive'
          ? 'This target looks externally visible or destructive and requires approval.'
          : 'Clicking can change page state and requires approval.',
      confirmationLabel: `Click ${targetLabel}`,
      targetLabel,
    };
  }

  return {
    decision: 'block',
    risk: 'target',
    reason: `Action blocked: unsupported browser tool ${args.toolName}.`,
    targetLabel,
  };
}

function getUnsafeTargetReason(
  target: HTMLElement,
): { risk: ActionSafetyRisk; reason: string } | null {
  if (isExtensionOwnedTarget(target)) {
    return {
      risk: 'target',
      reason: 'Action blocked: target belongs to the Tribora extension UI.',
    };
  }
  if (target instanceof HTMLInputElement && target.type === 'hidden') {
    return {
      risk: 'target',
      reason: 'Action blocked: target is hidden.',
    };
  }
  if (target.hidden || target.closest('[hidden], [inert]')) {
    return {
      risk: 'target',
      reason: 'Action blocked: target is hidden.',
    };
  }
  if (isDisabled(target)) {
    return {
      risk: 'target',
      reason: 'Action blocked: target is disabled.',
    };
  }
  const style = target.ownerDocument.defaultView?.getComputedStyle(target);
  if (
    style &&
    (style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.pointerEvents === 'none')
  ) {
    return {
      risk: 'target',
      reason: 'Action blocked: target is not visible or interactive.',
    };
  }
  return null;
}

function isDisabled(target: HTMLElement): boolean {
  if ('disabled' in target && Boolean(target.disabled)) return true;
  if (target.getAttribute('aria-disabled') === 'true') return true;
  return Boolean(target.closest('[aria-disabled="true"]'));
}

function isExtensionOwnedTarget(target: HTMLElement): boolean {
  return Boolean(
    target.closest(
      '#tribora-widget, #tribora-overlay, #tribora-action-confirmation, [data-tribora-owner="true"]',
    ),
  );
}

function isSensitiveTypingTarget(target: HTMLElement): boolean {
  if (target instanceof HTMLInputElement) {
    const inputType = target.type.toLowerCase();
    if (
      [
        'password',
        'tel',
        'date',
        'datetime-local',
        'month',
        'number',
        'time',
        'week',
      ].includes(inputType) &&
      SENSITIVE_FIELD_PATTERN.test(targetDescriptor(target))
    ) {
      return true;
    }
    if (inputType === 'password') return true;
    if (
      ['cc-name', 'cc-number', 'cc-exp', 'cc-csc', 'one-time-code'].some(
        (token) => target.autocomplete?.toLowerCase().includes(token),
      )
    ) {
      return true;
    }
  }

  return SENSITIVE_FIELD_PATTERN.test(targetDescriptor(target));
}

function targetTextIsDestructive(target: HTMLElement): boolean {
  return DESTRUCTIVE_LABEL_PATTERN.test(targetDescriptor(target));
}

function textLooksSensitive(value: string | undefined): boolean {
  if (!value) return false;
  return SENSITIVE_TEXT_PATTERN.test(value);
}

function targetDescriptor(target: HTMLElement): string {
  const pieces = [
    target.getAttribute('aria-label'),
    target.getAttribute('aria-labelledby')
      ? collectLabelledByText(target)
      : undefined,
    target.getAttribute('title'),
    target.getAttribute('placeholder'),
    target.getAttribute('name'),
    target.id,
    target.getAttribute('type'),
    target.closest('label')?.textContent,
    target.textContent,
  ];

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const label = findExternalLabelText(target);
    if (label) pieces.push(label);
  }

  return pieces
    .filter((piece): piece is string => Boolean(piece))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeTarget(target: HTMLElement, selector?: string): string {
  const descriptor = bestTargetLabel(target);
  if (descriptor) return truncate(descriptor, 70);
  const role = target.getAttribute('role');
  const tag = target.tagName.toLowerCase();
  if (role) return `${role} ${selector ?? tag}`;
  return selector ? `${tag} ${selector}` : tag;
}

function bestTargetLabel(target: HTMLElement): string {
  const explicitLabel = [
    target.getAttribute('aria-label') ??
      '',
    target.getAttribute('aria-labelledby') ? collectLabelledByText(target) : '',
    target.getAttribute('title') ?? '',
    target.getAttribute('placeholder') ?? '',
  ].find((candidate) => candidate.trim());
  if (explicitLabel) return explicitLabel.replace(/\s+/g, ' ').trim();

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const label =
      target.closest('label')?.textContent ?? findExternalLabelText(target);
    if (label.trim()) return label.replace(/\s+/g, ' ').trim();
  }

  const text = target.textContent?.replace(/\s+/g, ' ').trim();
  if (text) return text;

  return target.getAttribute('name') ?? target.id;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function collectLabelledByText(target: HTMLElement): string {
  const ids = (target.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return ids
    .map((id) => target.ownerDocument.getElementById(id)?.textContent ?? '')
    .join(' ');
}

function findExternalLabelText(
  target: HTMLInputElement | HTMLTextAreaElement,
): string {
  if (!target.id) return '';
  const label = Array.from(
    target.ownerDocument.querySelectorAll<HTMLLabelElement>('label[for]'),
  ).find((candidate) => candidate.htmlFor === target.id);
  return label?.textContent ?? '';
}

function clickMayNavigate(target: HTMLElement): boolean {
  return Boolean(
    target.closest(
      'a[href], form button[type="submit"], button[type="submit"], input[type="submit"]',
    ),
  );
}

function normalizeKeyPress(args: Pick<ActionSafetyArgs, 'key' | 'modifiers'>): {
  key: string;
  modifiers: string[];
} {
  const rawKey = String(args.key ?? '').trim();
  const keyParts = rawKey
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const key = normalizeKeyName(keyParts.pop() ?? rawKey);
  const modifiers = [...keyParts, ...(args.modifiers ?? [])]
    .map(normalizeModifier)
    .filter((modifier): modifier is string => Boolean(modifier));
  return {
    key,
    modifiers: Array.from(new Set(modifiers)).sort(sortModifiers),
  };
}

function normalizeModifier(modifier: string): string | null {
  switch (modifier.trim().toLowerCase()) {
    case 'cmd':
    case 'command':
    case 'meta':
      return 'Meta';
    case 'ctrl':
    case 'control':
      return 'Control';
    case 'option':
    case 'alt':
      return 'Alt';
    case 'shift':
      return 'Shift';
    default:
      return null;
  }
}

function normalizeKeyName(key: string): string {
  const trimmed = key.trim();
  if (trimmed === ' ') return 'Space';
  if (/^space(bar)?$/i.test(trimmed)) return 'Space';
  if (/^esc$/i.test(trimmed)) return 'Escape';
  if (/^del$/i.test(trimmed)) return 'Delete';
  if (/^[a-z]$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

function sortModifiers(left: string, right: string): number {
  const order = ['Control', 'Alt', 'Meta', 'Shift'];
  return order.indexOf(left) - order.indexOf(right);
}

function formatShortcut(modifiers: string[], key: string): string {
  return [...modifiers, key].filter(Boolean).join('+');
}

function keyCanEditText(key: string): boolean {
  return key.length === 1 || /^(backspace|delete|space|enter)$/i.test(key);
}

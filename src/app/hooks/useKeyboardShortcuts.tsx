import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Keyboard shortcut definition (object format)
 */
export interface Shortcut {
  key: string;
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
  global?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Keyboard shortcut definition (array format) - deprecated, use Shortcut instead
 */
export interface KeyboardShortcut {
  keys: string[]; // e.g., ['cmd', 'k'] or ['ctrl', 'k']
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
  global?: boolean; // If true, works even when input is focused
}

/**
 * Check if the current platform is Mac
 */
export const isMac = () => {
  if (typeof window === 'undefined') return false;
  // Use userAgent as navigator.platform is deprecated
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
};

/**
 * Get the appropriate modifier key label
 */
export const getModifierKey = () => {
  return isMac() ? '⌘' : 'Ctrl';
};

/**
 * Common keyboard shortcuts used across the application
 */
export const COMMON_SHORTCUTS = {
  SEARCH: { key: 'k', ctrl: true },
  UPLOAD: { key: 'u', ctrl: true },
  NEW_NOTE: { key: 'n', ctrl: true },
  RECORD: { key: 'r', alt: true },
  HELP: { key: '?' },
  ESCAPE: { key: 'Escape' },
  NEXT: { key: 'j' },
  PREVIOUS: { key: 'k' },
  SELECT: { key: 'Enter' },
  SELECT_ALL: { key: 'a', ctrl: true },
  MULTI_SELECT: { key: 'shift' },
  FAVORITES: { key: 'f' },
  DELETE: { key: 'Delete' },
  COPY: { key: 'c', ctrl: true },
  PASTE: { key: 'v', ctrl: true },
  UNDO: { key: 'z', ctrl: true },
  REDO: { key: 'y', ctrl: true },
};

/**
 * Format shortcut keys for display
 */
export const formatShortcut = (
  keys: string[] | { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }
): string => {
  // Handle object format
  if (!Array.isArray(keys)) {
    const parts: string[] = [];
    if (keys.ctrl) parts.push('Ctrl');
    if (keys.shift) parts.push('Shift');
    if (keys.alt) parts.push('Alt');
    if (keys.meta) parts.push(isMac() ? '⌘' : 'Meta');
    parts.push(keys.key);
    keys = parts;
  }

  return keys
    .map((key) => {
      switch (key.toLowerCase()) {
        case 'cmd':
        case 'meta':
          return '⌘';
        case 'ctrl':
          return 'Ctrl';
        case 'alt':
          return '⌥';
        case 'shift':
          return '⇧';
        case 'enter':
          return '⏎';
        case 'escape':
        case 'esc':
          return 'Esc';
        case 'arrowup':
          return '↑';
        case 'arrowdown':
          return '↓';
        case 'arrowleft':
          return '←';
        case 'arrowright':
          return '→';
        default:
          return key.toUpperCase();
      }
    })
    .join(' + ');
};

/**
 * Check if an element is an input or editable
 */
const isEditableElement = (element: EventTarget | null): boolean => {
  if (!element || !(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();
  const isEditable = (element as HTMLElement).contentEditable === 'true';
  const isInput = ['input', 'textarea', 'select'].includes(tagName);

  return isEditable || isInput;
};

/**
 * Check if a keyboard event matches a shortcut (object format)
 */
function checkShortcutMatchObject(event: KeyboardEvent, shortcut: Shortcut): boolean {
  // Check if the key matches
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }

  // Check modifiers - only verify required modifiers are pressed
  const requiredCtrl = shortcut.ctrl === true;
  const requiredShift = shortcut.shift === true;
  const requiredAlt = shortcut.alt === true;
  const requiredMeta = shortcut.meta === true;

  // If a modifier is required but not pressed, no match
  if (requiredCtrl && !event.ctrlKey) return false;
  if (requiredShift && !event.shiftKey) return false;
  if (requiredAlt && !event.altKey) return false;
  if (requiredMeta && !event.metaKey) return false;

  // If a modifier is pressed but not required, no match
  // (with some leniency for Ctrl/Meta on Mac/Windows)
  if (!requiredCtrl && !requiredMeta && event.ctrlKey) return false;
  if (!requiredShift && event.shiftKey) return false;
  if (!requiredAlt && event.altKey) return false;
  if (!requiredMeta && !requiredCtrl && event.metaKey) return false;

  return true;
}

/**
 * Custom hook for keyboard shortcuts with dynamic registration
 */
export function useKeyboardShortcuts(initialShortcuts: Shortcut[] = []) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(initialShortcuts);
  const shortcutsRef = useRef<Shortcut[]>(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  // Register a new shortcut dynamically
  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts((prev) => [...prev, shortcut]);
  }, []);

  // Unregister a shortcut by key
  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const activeShortcuts = shortcutsRef.current.filter((shortcut) => shortcut.enabled !== false);

    for (const shortcut of activeShortcuts) {
      // Skip non-global shortcuts if an input is focused
      if (!shortcut.global && isEditableElement(event.target)) {
        continue;
      }

      const matches = checkShortcutMatchObject(event, shortcut);

      if (matches) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        if (shortcut.stopPropagation) {
          event.stopPropagation();
        }
        shortcut.handler(event);
        break; // Only trigger the first matching shortcut
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { registerShortcut, unregisterShortcut };
}

/**
 * Check if a keyboard event matches a shortcut (array format)
 */
function checkShortcutMatch(event: KeyboardEvent, keys: string[]): boolean {
  const modifiers = {
    cmd: isMac() ? event.metaKey : event.ctrlKey,
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };

  // Normalize keys to lowercase
  const normalizedKeys = keys.map((k) => k.toLowerCase());

  // Check each key in the shortcut
  for (const key of normalizedKeys) {
    if (key in modifiers) {
      // It's a modifier key
      if (!modifiers[key as keyof typeof modifiers]) {
        return false;
      }
    } else {
      // It's a regular key
      const eventKey = event.key.toLowerCase();
      if (eventKey !== key) {
        return false;
      }
    }
  }

  // Check that no extra modifiers are pressed
  const requiredModifiers = normalizedKeys.filter((k) => k in modifiers);
  const activeModifiers = Object.entries(modifiers)
    .filter(([_, active]) => active)
    .map(([name]) => name);

  // For cmd/meta, treat them as equivalent
  const normalizeModifier = (m: string) => (m === 'meta' || m === 'cmd' ? 'cmd' : m);
  const normalizedRequired = requiredModifiers.map(normalizeModifier);
  const normalizedActive = activeModifiers.map(normalizeModifier);

  // Check if all active modifiers are in the required list
  for (const active of normalizedActive) {
    if (!normalizedRequired.includes(active)) {
      return false;
    }
  }

  return true;
}

/**
 * Hook for a single keyboard shortcut (array format) - deprecated
 */
export function useKeyboardShortcut(
  keys: string[],
  handler: (event: KeyboardEvent) => void,
  options?: {
    enabled?: boolean;
    global?: boolean;
    preventDefault?: boolean;
  },
  dependencies: any[] = []
) {
  const shortcutRef = useRef<KeyboardShortcut>({
    keys,
    handler,
    ...options,
  });

  // Update ref when dependencies change
  useEffect(() => {
    shortcutRef.current = {
      keys,
      handler,
      ...options,
    };
  }, dependencies);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const shortcut = shortcutRef.current;

    if (shortcut.enabled === false) return;

    // Skip non-global shortcuts if an input is focused
    if (!shortcut.global && isEditableElement(event.target)) {
      return;
    }

    const matches = checkShortcutMatch(event, shortcut.keys);

    if (matches) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }
      if (shortcut.stopPropagation) {
        event.stopPropagation();
      }
      shortcut.handler(event);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

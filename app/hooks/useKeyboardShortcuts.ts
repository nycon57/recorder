'use client';

import { useEffect, useCallback, useRef } from 'react';

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description?: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  ignoreInputFields?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, ignoreInputFields = true } = options;
  const shortcutsRef = useRef(shortcuts);

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in input fields
      if (ignoreInputFields) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const isContentEditable = target.contentEditable === 'true';

        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          isContentEditable
        ) {
          return;
        }
      }

      // Check each shortcut
      for (const shortcut of shortcutsRef.current) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (!keyMatches) continue;

        // Check modifiers - only verify required modifiers are pressed
        const requiredCtrl = shortcut.ctrl === true;
        const requiredShift = shortcut.shift === true;
        const requiredAlt = shortcut.alt === true;
        const requiredMeta = shortcut.meta === true;

        // If a modifier is required but not pressed, no match
        if (requiredCtrl && !event.ctrlKey) continue;
        if (requiredShift && !event.shiftKey) continue;
        if (requiredAlt && !event.altKey) continue;
        if (requiredMeta && !event.metaKey) continue;

        // If a modifier is pressed but not required, no match
        // (with some leniency for Ctrl/Meta on Mac/Windows)
        if (!requiredCtrl && !requiredMeta && event.ctrlKey) continue;
        if (!requiredShift && event.shiftKey) continue;
        if (!requiredAlt && event.altKey) continue;
        if (!requiredMeta && !requiredCtrl && event.metaKey) continue;

        // All checks passed - trigger the shortcut
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }
        shortcut.handler(event);
        break;
      }
    },
    [enabled, ignoreInputFields]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    shortcutsRef.current = [...shortcutsRef.current, shortcut];
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    shortcutsRef.current = shortcutsRef.current.filter(s => s.key !== key);
  }, []);

  return {
    registerShortcut,
    unregisterShortcut,
  };
}

// Pre-defined shortcuts for common actions
export const COMMON_SHORTCUTS = {
  SEARCH: { key: 'k', ctrl: true, description: 'Open search' },
  UPLOAD: { key: 'u', ctrl: true, description: 'Open upload' },
  NEW_NOTE: { key: 'n', ctrl: true, description: 'Create new note' },
  RECORD: { key: 'r', description: 'Start recording' },
  FAVORITES: { key: 'f', description: 'Toggle favorites filter' },
  HELP: { key: '?', description: 'Show keyboard shortcuts' },
  ESCAPE: { key: 'Escape', description: 'Close modals' },
  NEXT: { key: 'ArrowRight', description: 'Next item' },
  PREVIOUS: { key: 'ArrowLeft', description: 'Previous item' },
  SELECT: { key: 'Enter', description: 'Select item' },
  MULTI_SELECT: { key: ' ', shift: true, description: 'Multi-select' },
  SELECT_ALL: { key: 'a', ctrl: true, description: 'Select all' },
  DELETE: { key: 'Delete', description: 'Delete selected' },
  COPY: { key: 'c', ctrl: true, description: 'Copy' },
  PASTE: { key: 'v', ctrl: true, description: 'Paste' },
  UNDO: { key: 'z', ctrl: true, description: 'Undo' },
  REDO: { key: 'z', ctrl: true, shift: true, description: 'Redo' },
};

// Helper function to format shortcut for display
export function formatShortcut(shortcut: Partial<Shortcut>): string {
  const isMac = typeof window !== 'undefined' && navigator?.platform?.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format the key
  let key = shortcut.key || '';
  if (key === 'ArrowLeft') key = '←';
  else if (key === 'ArrowRight') key = '→';
  else if (key === 'ArrowUp') key = '↑';
  else if (key === 'ArrowDown') key = '↓';
  else if (key === 'Enter') key = isMac ? '↵' : 'Enter';
  else if (key === 'Escape') key = isMac ? '⎋' : 'Esc';
  else if (key === 'Delete') key = isMac ? '⌫' : 'Del';
  else if (key === ' ') key = 'Space';
  else key = key.toUpperCase();

  parts.push(key);

  return parts.join(isMac ? '' : '+');
}
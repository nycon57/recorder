'use client';

import React, {
  createContext,
  use,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';

import {
  useKeyboardShortcuts,
  Shortcut,
  formatShortcut,
} from '@/app/hooks/useKeyboardShortcuts';
import { useToast } from '@/app/components/ui/use-toast';

interface ShortcutDefinition {
  id: string;
  keys: string[];
  description: string;
  category: 'Navigation' | 'Actions' | 'Filters' | 'General';
  global?: boolean;
  handler?: (event: KeyboardEvent) => void;
}

interface KeyboardShortcutsContextType {
  shortcuts: ShortcutDefinition[];
  isHelpOpen: boolean;
  toggleHelp: () => void;
  registerShortcut: (shortcut: ShortcutDefinition) => void;
  unregisterShortcut: (id: string) => void;
  triggerShortcut: (id: string) => void;
}

const KeyboardShortcutsContext = createContext<
  KeyboardShortcutsContextType | undefined
>(undefined);

function KeyboardShortcutsProvider(
  props: Parameters<typeof useKeyboardShortcutsProviderImplementation>[0],
) {
  return useKeyboardShortcutsProviderImplementation(props);
}

function useKeyboardShortcutsProviderImplementation({
  children,
}: {
  children: React.ReactNode;
}) {
  const { push } = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutDefinition[]>(
    [],
  );

  const toggleHelp = useCallback(() => {
    setIsHelpOpen((prev) => !prev);
  }, []);

  // Quick Search (Cmd/Ctrl + K)
  const handleQuickSearch = useCallback(() => {
    const searchInput = document.querySelector(
      'input[placeholder*="Search"]',
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    } else if (pathname !== '/search') {
      push('/search');
    }
  }, [pathname, push]);

  // Upload (Cmd/Ctrl + U)
  const handleUpload = useCallback(() => {
    // Trigger upload modal by clicking the upload button
    const uploadButton = document.querySelector(
      '[data-upload-button]',
    ) as HTMLElement;
    if (uploadButton) {
      uploadButton.click();
    } else {
      toast({
        title: 'Upload',
        description: 'Navigate to the library to upload files',
      });
    }
  }, [toast]);

  // New Note (Cmd/Ctrl + N)
  const handleNewNote = useCallback(() => {
    // Create a new note
    const newNoteButton = document.querySelector(
      '[data-new-note-button]',
    ) as HTMLElement;
    if (newNoteButton) {
      newNoteButton.click();
    } else {
      push('/notes/new');
    }
  }, [push]);

  // Start Recording (R - when not in input)
  const handleStartRecording = useCallback(() => {
    if (pathname !== '/record') {
      push('/record');
    } else {
      // Trigger recording start
      const recordButton = document.querySelector(
        '[data-record-button]',
      ) as HTMLElement;
      if (recordButton) {
        recordButton.click();
      }
    }
  }, [pathname, push]);

  // Toggle Favorites (F - when not in input)
  const handleToggleFavorites = useCallback(() => {
    const favoritesCheckbox = document.querySelector(
      '[data-favorites-filter]',
    ) as HTMLInputElement;
    if (favoritesCheckbox) {
      favoritesCheckbox.click();
    }
  }, []);

  // Navigation shortcuts
  const handleGoToDashboard = useCallback(() => {
    push('/dashboard');
  }, [push]);

  const handleGoToLibrary = useCallback(() => {
    push('/library');
  }, [push]);

  const handleGoToAssistant = useCallback(() => {
    push('/assistant');
  }, [push]);

  // PERF-FE-004: Memoize default shortcuts to prevent recreation on every render
  const defaultShortcuts = useMemo<ShortcutDefinition[]>(
    () => [
      {
        id: 'quick-search',
        keys: ['cmd', 'k'],
        description: 'Quick search',
        category: 'General',
        global: true,
        handler: handleQuickSearch,
      },
      {
        id: 'upload',
        keys: ['cmd', 'u'],
        description: 'Upload files',
        category: 'Actions',
        global: true,
        handler: handleUpload,
      },
      {
        id: 'new-note',
        keys: ['cmd', 'n'],
        description: 'Create new note',
        category: 'Actions',
        global: true,
        handler: handleNewNote,
      },
      {
        id: 'record',
        keys: ['r'],
        description: 'Start recording',
        category: 'Actions',
        handler: handleStartRecording,
      },
      {
        id: 'toggle-favorites',
        keys: ['f'],
        description: 'Toggle favorites filter',
        category: 'Filters',
        handler: handleToggleFavorites,
      },
      {
        id: 'help',
        keys: ['shift', '?'],
        description: 'Show keyboard shortcuts',
        category: 'General',
        global: true,
        handler: toggleHelp,
      },
      {
        id: 'escape',
        keys: ['escape'],
        description: 'Close modals / Clear selection',
        category: 'General',
        global: true,
        handler: () => {
          // Close modals
          const closeButtons = document.querySelectorAll('[data-modal-close]');
          closeButtons.forEach((btn) => (btn as HTMLElement).click());

          // Clear selections
          const clearButton = document.querySelector(
            '[data-clear-selection]',
          ) as HTMLElement;
          if (clearButton) {
            clearButton.click();
          }
        },
      },
      {
        id: 'go-dashboard',
        keys: ['g', 'd'],
        description: 'Go to dashboard',
        category: 'Navigation',
        handler: handleGoToDashboard,
      },
      {
        id: 'go-library',
        keys: ['g', 'l'],
        description: 'Go to library',
        category: 'Navigation',
        handler: handleGoToLibrary,
      },
      {
        id: 'go-assistant',
        keys: ['g', 'a'],
        description: 'Go to AI assistant',
        category: 'Navigation',
        handler: handleGoToAssistant,
      },
      {
        id: 'select-all',
        keys: ['cmd', 'a'],
        description: 'Select all items',
        category: 'Actions',
        handler: () => {
          const selectAllCheckbox = document.querySelector(
            '[data-select-all]',
          ) as HTMLInputElement;
          if (selectAllCheckbox) {
            selectAllCheckbox.click();
          }
        },
      },
      {
        id: 'delete',
        keys: ['delete'],
        description: 'Delete selected items',
        category: 'Actions',
        handler: () => {
          const deleteButton = document.querySelector(
            '[data-delete-selected]',
          ) as HTMLElement;
          if (deleteButton) {
            deleteButton.click();
          }
        },
      },
    ],
    [
      handleQuickSearch,
      handleUpload,
      handleNewNote,
      handleStartRecording,
      handleToggleFavorites,
      toggleHelp,
      handleGoToDashboard,
      handleGoToLibrary,
      handleGoToAssistant,
    ],
  );

  // PERF-FE-004: Memoize combined shortcuts
  const allShortcuts = useMemo(
    () => [...defaultShortcuts, ...customShortcuts],
    [defaultShortcuts, customShortcuts],
  );

  // Register shortcut
  const registerShortcut = useCallback((shortcut: ShortcutDefinition) => {
    setCustomShortcuts((prev) => {
      // Remove existing shortcut with same ID
      const filtered = prev.filter((s) => s.id !== shortcut.id);
      return [...filtered, shortcut];
    });
  }, []);

  // Unregister shortcut
  const unregisterShortcut = useCallback((id: string) => {
    setCustomShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Trigger shortcut manually
  const triggerShortcut = useCallback(
    (id: string) => {
      const shortcut = allShortcuts.find((s) => s.id === id);
      if (shortcut?.handler) {
        shortcut.handler(new KeyboardEvent('keydown'));
      }
    },
    [allShortcuts],
  );

  // PERF-FE-004: Memoize keyboard shortcuts conversion
  const keyboardShortcuts = useMemo<Shortcut[]>(
    () =>
      allShortcuts.flatMap((__item, __index, __array) =>
        __item.handler
          ? [
              {
                key: __item.keys[0], // Use first key as the primary key
                ctrl:
                  __item.keys.includes('cmd') || __item.keys.includes('ctrl'),
                shift: __item.keys.includes('shift'),
                alt: __item.keys.includes('alt'),
                meta:
                  __item.keys.includes('cmd') || __item.keys.includes('meta'),
                handler: __item.handler!,
                description: __item.description,
                preventDefault: true,
              },
            ]
          : [],
      ),
    [allShortcuts],
  );

  // Use the keyboard shortcuts hook
  useKeyboardShortcuts(keyboardShortcuts, {
    enabled: true,
    ignoreInputFields: true,
  });

  // PERF-FE-004: Memoize context value to prevent consumer re-renders
  const contextValue = useMemo<KeyboardShortcutsContextType>(
    () => ({
      shortcuts: allShortcuts,
      isHelpOpen,
      toggleHelp,
      registerShortcut,
      unregisterShortcut,
      triggerShortcut,
    }),
    [
      allShortcuts,
      isHelpOpen,
      toggleHelp,
      registerShortcut,
      unregisterShortcut,
      triggerShortcut,
    ],
  );

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcutsContext() {
  const context = use(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error(
      'useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider',
    );
  }
  return context;
}

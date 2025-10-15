'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useKeyboardShortcuts, COMMON_SHORTCUTS, type Shortcut } from '@/app/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { toast } from '@/app/components/ui/use-toast';

interface KeyboardShortcutsContextType {
  showHelp: () => void;
  hideHelp: () => void;
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (key: string) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

export function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider');
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
  onSearch?: () => void;
  onUpload?: () => void;
  onNewNote?: () => void;
  onRecord?: () => void;
  onToggleFavorites?: () => void;
}

export function KeyboardShortcutsProvider({
  children,
  onSearch,
  onUpload,
  onNewNote,
  onRecord,
  onToggleFavorites,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const showHelp = useCallback(() => setIsHelpOpen(true), []);
  const hideHelp = useCallback(() => setIsHelpOpen(false), []);

  // Define global shortcuts
  const shortcuts: Shortcut[] = [
    // Search
    {
      ...COMMON_SHORTCUTS.SEARCH,
      handler: () => {
        if (onSearch) {
          onSearch();
        } else {
          // Default: navigate to search page
          router.push('/search');
        }
      },
    },
    // Upload
    {
      ...COMMON_SHORTCUTS.UPLOAD,
      handler: () => {
        if (onUpload) {
          onUpload();
        } else {
          toast({
            title: 'Upload',
            description: 'Upload modal would open here',
          });
        }
      },
    },
    // New Note
    {
      ...COMMON_SHORTCUTS.NEW_NOTE,
      handler: () => {
        if (onNewNote) {
          onNewNote();
        } else {
          toast({
            title: 'New Note',
            description: 'Note creation would start here',
          });
        }
      },
    },
    // Record
    {
      ...COMMON_SHORTCUTS.RECORD,
      handler: () => {
        if (pathname === '/record') return; // Already on record page

        if (onRecord) {
          onRecord();
        } else {
          router.push('/record');
        }
      },
    },
    // Favorites
    {
      ...COMMON_SHORTCUTS.FAVORITES,
      handler: () => {
        if (onToggleFavorites) {
          onToggleFavorites();
        } else {
          toast({
            title: 'Favorites',
            description: 'Favorites filter toggled',
          });
        }
      },
    },
    // Help
    {
      ...COMMON_SHORTCUTS.HELP,
      handler: showHelp,
    },
    // Escape - close modals
    {
      ...COMMON_SHORTCUTS.ESCAPE,
      handler: () => {
        if (isHelpOpen) {
          hideHelp();
        }
        // Let other components handle escape for their modals
      },
      preventDefault: false, // Allow other handlers to also process escape
    },
    // Navigation shortcuts
    {
      key: 'g',
      handler: (e) => {
        // Two-key shortcuts: g then another key
        const listener = (event: KeyboardEvent) => {
          switch (event.key) {
            case 'h':
              router.push('/dashboard');
              break;
            case 'r':
              router.push('/recordings');
              break;
            case 's':
              router.push('/search');
              break;
            case 'a':
              router.push('/analytics');
              break;
            case 'l':
              router.push('/library');
              break;
            case 'c':
              router.push('/collections');
              break;
            case 't':
              router.push('/assistant');
              break;
          }
          window.removeEventListener('keyup', listener);
        };

        window.addEventListener('keyup', listener);

        // Remove listener after 2 seconds if no second key pressed
        setTimeout(() => {
          window.removeEventListener('keyup', listener);
        }, 2000);
      },
    },
    // Quick actions with numbers
    {
      key: '1',
      alt: true,
      handler: () => router.push('/dashboard'),
    },
    {
      key: '2',
      alt: true,
      handler: () => router.push('/recordings'),
    },
    {
      key: '3',
      alt: true,
      handler: () => router.push('/search'),
    },
    {
      key: '4',
      alt: true,
      handler: () => router.push('/assistant'),
    },
    {
      key: '5',
      alt: true,
      handler: () => router.push('/analytics'),
    },
  ];

  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts(shortcuts);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        showHelp,
        hideHelp,
        registerShortcut,
        unregisterShortcut,
      }}
    >
      {children}
      <KeyboardShortcutsDialog isOpen={isHelpOpen} onClose={hideHelp} />
    </KeyboardShortcutsContext.Provider>
  );
}
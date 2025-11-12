'use client';

import * as React from 'react';
import { Command } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'playback' | 'navigation' | 'actions' | 'general';
}

const shortcuts: KeyboardShortcut[] = [
  // Playback controls (for video/audio)
  { keys: ['Space'], description: 'Play / Pause', category: 'playback' },
  { keys: ['←'], description: 'Rewind 5 seconds', category: 'playback' },
  { keys: ['→'], description: 'Forward 5 seconds', category: 'playback' },
  { keys: ['↑'], description: 'Increase volume', category: 'playback' },
  { keys: ['↓'], description: 'Decrease volume', category: 'playback' },
  { keys: ['M'], description: 'Mute / Unmute', category: 'playback' },
  { keys: ['F'], description: 'Toggle fullscreen', category: 'playback' },

  // Navigation
  { keys: ['Tab'], description: 'Switch between tabs', category: 'navigation' },
  { keys: ['Esc'], description: 'Close dialogs', category: 'navigation' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'navigation' },

  // Actions
  { keys: ['Cmd', 'D'], description: 'Download content', category: 'actions' },
  { keys: ['Ctrl', 'D'], description: 'Download content (Windows)', category: 'actions' },
  { keys: ['Cmd', 'E'], description: 'Edit details', category: 'actions' },
  { keys: ['Ctrl', 'E'], description: 'Edit details (Windows)', category: 'actions' },
  { keys: ['Cmd', 'F'], description: 'Search in transcript', category: 'actions' },
  { keys: ['Ctrl', 'F'], description: 'Search in transcript (Windows)', category: 'actions' },
  { keys: ['Cmd', 'Shift', 'R'], description: 'Reprocess content', category: 'actions' },
  { keys: ['Ctrl', 'Shift', 'R'], description: 'Reprocess content (Windows)', category: 'actions' },

  // General
  { keys: ['Cmd', 'K'], description: 'Open command palette', category: 'general' },
  { keys: ['Ctrl', 'K'], description: 'Open command palette (Windows)', category: 'general' },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType?: 'recording' | 'video' | 'audio' | 'document' | 'text' | null;
}

export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  contentType,
}: KeyboardShortcutsDialogProps) {
  // Filter shortcuts based on content type
  const getRelevantShortcuts = () => {
    const isMedia = contentType === 'recording' || contentType === 'video' || contentType === 'audio';

    return shortcuts.filter((shortcut) => {
      // Show playback controls only for media content
      if (shortcut.category === 'playback') {
        return isMedia;
      }
      return true;
    });
  };

  const relevantShortcuts = getRelevantShortcuts();

  // Group shortcuts by category
  const groupedShortcuts = relevantShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  const categoryLabels: Record<string, string> = {
    playback: 'Playback Controls',
    navigation: 'Navigation',
    actions: 'Actions',
    general: 'General',
  };

  const categoryOrder = ['playback', 'navigation', 'actions', 'general'];

  const renderKey = (key: string) => {
    // Replace modifier key names with symbols
    const keyMap: Record<string, string> = {
      'Cmd': '⌘',
      'Ctrl': 'Ctrl',
      'Shift': '⇧',
      'Alt': '⌥',
      'Space': 'Space',
      '←': '←',
      '→': '→',
      '↑': '↑',
      '↓': '↓',
    };

    return keyMap[key] || key;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="size-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up your workflow with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {categoryOrder.map((category) => {
            const categoryShortcuts = groupedShortcuts[category];
            if (!categoryShortcuts || categoryShortcuts.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {categoryLabels[category]}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={`${category}-${index}`}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span className="text-xs text-muted-foreground mx-0.5">+</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                              {renderKey(key)}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">?</kbd> to show/hide this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

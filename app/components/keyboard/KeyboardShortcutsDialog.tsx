'use client';

import React from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { useKeyboardShortcutsContext } from '@/app/contexts/KeyboardShortcutsContext';
import { formatShortcut, isMac } from '@/app/hooks/useKeyboardShortcuts';

/**
 * Keyboard Shortcuts Help Dialog
 * Displays all available keyboard shortcuts organized by category
 */
export function KeyboardShortcutsDialog() {
  const { shortcuts, isHelpOpen, toggleHelp } = useKeyboardShortcutsContext();

  // Group shortcuts by category
  const shortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  const categoryOrder = ['General', 'Navigation', 'Actions', 'Filters'];
  const sortedCategories = categoryOrder.filter((cat) => shortcutsByCategory[cat]);

  return (
    <Dialog open={isHelpOpen} onOpenChange={toggleHelp}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Quick keyboard shortcuts to navigate and control the application
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {sortedCategories.map((category, categoryIndex) => (
            <div key={category}>
              {categoryIndex > 0 && <Separator className="mb-4" />}

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </h3>

                <div className="space-y-2">
                  {shortcutsByCategory[category].map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-2">
                        {shortcut.global && (
                          <Badge variant="secondary" className="text-xs">
                            Global
                          </Badge>
                        )}
                        <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted rounded border border-border">
                          {formatShortcut(
                            shortcut.keys.map((key) => {
                              // Replace 'cmd' with platform-appropriate key
                              if (key === 'cmd') {
                                return isMac() ? 'cmd' : 'ctrl';
                              }
                              return key;
                            })
                          )}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Tips:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Global shortcuts work even when inputs are focused</li>
              <li>Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Esc</kbd> to close modals and clear selections</li>
              <li>Use <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Tab</kbd> to navigate through interactive elements</li>
              <li>Navigation shortcuts use <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">G</kbd> followed by another key</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Keyboard shortcut hint component
 * Shows the keyboard shortcut inline with buttons/menu items
 */
interface KeyboardHintProps {
  keys: string[];
  className?: string;
}

export function KeyboardHint({ keys, className = '' }: KeyboardHintProps) {
  const formattedKeys = formatShortcut(
    keys.map((key) => {
      if (key === 'cmd') {
        return isMac() ? 'cmd' : 'ctrl';
      }
      return key;
    })
  );

  return (
    <kbd
      className={`ml-auto hidden sm:inline-flex px-1.5 py-0.5 text-xs font-medium text-muted-foreground bg-muted/50 rounded border border-border ${className}`}
    >
      {formattedKeys}
    </kbd>
  );
}
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Keyboard, Search, Printer } from 'lucide-react';
import { useState, useMemo } from 'react';
import { formatShortcut, COMMON_SHORTCUTS } from '@/app/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutKeys {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

interface ShortcutCategory {
  name: string;
  shortcuts: Array<{
    keys: ShortcutKeys;
    description: string;
  }>;
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    name: 'General',
    shortcuts: [
      { keys: COMMON_SHORTCUTS.SEARCH, description: 'Open search' },
      { keys: COMMON_SHORTCUTS.UPLOAD, description: 'Open upload modal' },
      { keys: COMMON_SHORTCUTS.NEW_NOTE, description: 'Create new note' },
      { keys: COMMON_SHORTCUTS.RECORD, description: 'Start recording' },
      { keys: COMMON_SHORTCUTS.HELP, description: 'Show this help' },
      { keys: COMMON_SHORTCUTS.ESCAPE, description: 'Close modals/dialogs' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: COMMON_SHORTCUTS.NEXT, description: 'Navigate to next item' },
      { keys: COMMON_SHORTCUTS.PREVIOUS, description: 'Navigate to previous item' },
      { keys: { key: 'ArrowUp' }, description: 'Move selection up' },
      { keys: { key: 'ArrowDown' }, description: 'Move selection down' },
      { keys: { key: 'Home' }, description: 'Go to first item' },
      { keys: { key: 'End' }, description: 'Go to last item' },
      { keys: COMMON_SHORTCUTS.SELECT, description: 'Select/open item' },
      { keys: { key: 'Tab' }, description: 'Move focus forward' },
      { keys: { key: 'Tab', shift: true }, description: 'Move focus backward' },
    ],
  },
  {
    name: 'Selection',
    shortcuts: [
      { keys: COMMON_SHORTCUTS.SELECT_ALL, description: 'Select all items' },
      { keys: { key: 'd', ctrl: true }, description: 'Deselect all' },
      { keys: COMMON_SHORTCUTS.MULTI_SELECT, description: 'Toggle multi-select' },
      { keys: { key: 'ArrowDown', shift: true }, description: 'Extend selection down' },
      { keys: { key: 'ArrowUp', shift: true }, description: 'Extend selection up' },
      { keys: { key: 'Click', ctrl: true }, description: 'Add to selection' },
    ],
  },
  {
    name: 'Actions',
    shortcuts: [
      { keys: COMMON_SHORTCUTS.FAVORITES, description: 'Toggle favorites filter' },
      { keys: { key: 'e', ctrl: true }, description: 'Export selected items' },
      { keys: COMMON_SHORTCUTS.DELETE, description: 'Delete selected items' },
      { keys: { key: 'r', ctrl: true }, description: 'Rename selected item' },
      { keys: { key: 's', ctrl: true }, description: 'Share selected item' },
      { keys: { key: 't' }, description: 'Add tag to selected' },
    ],
  },
  {
    name: 'Editing',
    shortcuts: [
      { keys: COMMON_SHORTCUTS.COPY, description: 'Copy' },
      { keys: COMMON_SHORTCUTS.PASTE, description: 'Paste' },
      { keys: { key: 'x', ctrl: true }, description: 'Cut' },
      { keys: COMMON_SHORTCUTS.UNDO, description: 'Undo' },
      { keys: COMMON_SHORTCUTS.REDO, description: 'Redo' },
      { keys: { key: 'b', ctrl: true }, description: 'Bold (in editor)' },
      { keys: { key: 'i', ctrl: true }, description: 'Italic (in editor)' },
    ],
  },
  {
    name: 'View',
    shortcuts: [
      { keys: { key: '1', alt: true }, description: 'Grid view' },
      { keys: { key: '2', alt: true }, description: 'List view' },
      { keys: { key: '3', alt: true }, description: 'Compact view' },
      { keys: { key: '+', ctrl: true }, description: 'Zoom in' },
      { keys: { key: '-', ctrl: true }, description: 'Zoom out' },
      { keys: { key: '0', ctrl: true }, description: 'Reset zoom' },
      { keys: { key: 'f11' }, description: 'Toggle fullscreen' },
    ],
  },
];

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
}: KeyboardShortcutsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredCategories = useMemo(() => {
    if (!searchQuery) {
      return selectedCategory === 'all'
        ? SHORTCUT_CATEGORIES
        : SHORTCUT_CATEGORIES.filter(cat => cat.name === selectedCategory);
    }

    const query = searchQuery.toLowerCase();
    return SHORTCUT_CATEGORIES.map(category => ({
      ...category,
      shortcuts: category.shortcuts.filter(
        shortcut =>
          shortcut.description.toLowerCase().includes(query) ||
          formatShortcut(shortcut.keys).toLowerCase().includes(query)
      ),
    })).filter(category => category.shortcuts.length > 0);
  }, [searchQuery, selectedCategory]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Keyboard Shortcuts</DialogTitle>
                <DialogDescription>
                  Quick actions to navigate and control the application
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative print:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Tabs */}
        <Tabs
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          defaultValue="all"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="w-full justify-start overflow-x-auto print:hidden">
            <TabsTrigger value="all">All</TabsTrigger>
            {SHORTCUT_CATEGORIES.map(cat => (
              <TabsTrigger key={cat.name} value={cat.name}>
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Shortcuts List */}
          <TabsContent
            value={selectedCategory}
            className="flex-1 overflow-y-auto mt-4 space-y-6"
          >
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No shortcuts found matching "{searchQuery}"
              </div>
            ) : (
              filteredCategories.map(category => (
                <div key={category.name} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.name}
                  </h3>
                  <div className="grid gap-2">
                    {category.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          'hover:bg-muted/50 transition-colors',
                          'print:border print:p-2'
                        )}
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-2">
                          <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border border-border">
                            {formatShortcut(shortcut.keys)}
                          </kbd>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Platform Info */}
        <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground print:hidden">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="font-normal">
              {navigator?.platform?.toUpperCase().indexOf('MAC') >= 0 ? 'macOS' : 'Windows/Linux'}
            </Badge>
            <span>Press ? anytime to show this dialog</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
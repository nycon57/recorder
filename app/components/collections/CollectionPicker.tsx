'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Folder } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Collection } from './CollectionTree';

interface CollectionPickerProps {
  collections: Collection[];
  selectedId: string | null;
  onSelect: (collectionId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * CollectionPicker Component
 * Dropdown for selecting a single collection
 *
 * Features:
 * - Search collections
 * - Show hierarchy in display
 * - Clear selection option
 * - Keyboard navigation
 * - Accessible combobox
 *
 * Usage:
 * <CollectionPicker
 *   collections={collections}
 *   selectedId={currentCollection}
 *   onSelect={setCollection}
 * />
 */
export function CollectionPicker({
  collections,
  selectedId,
  onSelect,
  placeholder = 'Select collection...',
  disabled = false,
  className,
}: CollectionPickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedCollection = collections.find((c) => c.id === selectedId);

  // Flatten tree with path for display
  const flattenWithPath = (
    items: Collection[],
    path: string[] = []
  ): Array<{ collection: Collection; path: string[] }> => {
    const result: Array<{ collection: Collection; path: string[] }> = [];

    items.forEach((item) => {
      const currentPath = [...path, item.name];
      result.push({ collection: item, path: currentPath });

      if (item.children && item.children.length > 0) {
        result.push(...flattenWithPath(item.children, currentPath));
      }
    });

    return result;
  };

  // Build tree structure
  const buildTree = (items: Collection[]): Collection[] => {
    const map = new Map<string, Collection>();
    const roots: Collection[] = [];

    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = React.useMemo(() => buildTree(collections), [collections]);
  const flatItems = React.useMemo(() => flattenWithPath(tree), [tree]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
          disabled={disabled}
        >
          {selectedCollection ? (
            <div className="flex items-center gap-2">
              <Folder className="size-4 text-blue-500" />
              <span>{selectedCollection.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search collections..." />
          <CommandList>
            <CommandEmpty>No collections found</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 size-4',
                    !selectedId ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="text-muted-foreground">No collection</span>
              </CommandItem>
              {flatItems.map(({ collection, path }) => (
                <CommandItem
                  key={collection.id}
                  value={path.join(' ')}
                  onSelect={() => {
                    onSelect(collection.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      selectedId === collection.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Folder className="mr-2 size-4 text-blue-500" />
                  <span className="flex-1 truncate">
                    {path.length > 1 ? path.join(' / ') : collection.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

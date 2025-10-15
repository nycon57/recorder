'use client';

import * as React from 'react';
import { ChevronRight, Home } from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb';
import { cn } from '@/lib/utils';
import type { Collection } from './CollectionTree';

interface CollectionBreadcrumbProps {
  collections: Collection[];
  currentId: string | null;
  onNavigate: (collectionId: string | null) => void;
  className?: string;
}

/**
 * CollectionBreadcrumb Component
 * Shows current collection path with navigation
 *
 * Features:
 * - Full path from root to current
 * - Clickable ancestors
 * - Home link to root
 * - Responsive truncation
 *
 * Usage:
 * <CollectionBreadcrumb
 *   collections={collections}
 *   currentId={currentCollection}
 *   onNavigate={handleNavigate}
 * />
 */
export function CollectionBreadcrumb({
  collections,
  currentId,
  onNavigate,
  className,
}: CollectionBreadcrumbProps) {
  // Build path from root to current
  const getPath = (id: string | null): Collection[] => {
    if (!id) return [];

    const path: Collection[] = [];
    const visited = new Set<string>();
    let current = collections.find((c) => c.id === id);

    while (current) {
      if (visited.has(current.id)) {
        console.error('Circular reference detected in collection hierarchy');
        break;
      }
      visited.add(current.id);
      path.unshift(current);
      current = collections.find((c) => c.id === current!.parent_id);
    }

    return path;
  };

  const path = currentId ? getPath(currentId) : [];

  return (
    <Breadcrumb className={cn(className)}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            onClick={() => onNavigate(null)}
            className="flex items-center gap-1 cursor-pointer"
          >
            <Home className="size-4" />
            <span>All Content</span>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {path.map((collection, index) => {
          const isLast = index === path.length - 1;

          return (
            <React.Fragment key={collection.id}>
              <BreadcrumbSeparator>
                <ChevronRight className="size-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{collection.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    onClick={() => onNavigate(collection.id)}
                    className="cursor-pointer"
                  >
                    {collection.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Brain,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type ConceptType,
  CONCEPT_TYPE_COLORS,
} from '@/lib/validations/knowledge';

import { ConceptTypeLabel } from './ConceptBadge';

/**
 * Props for ConceptListView component
 */
interface ConceptListViewProps {
  concepts: Array<{
    id: string;
    name: string;
    conceptType: ConceptType;
    mentionCount: number;
    description?: string | null;
  }>;
  onConceptClick?: (conceptId: string) => void;
  selectedConceptId?: string | null;
  isLoading?: boolean;
  className?: string;
  viewMode?: 'list' | 'grid';
}

/**
 * ConceptListView - Display concepts in list or grid format, organized by type
 *
 * Features:
 * - Group concepts by type (tool, process, technical_term, etc.)
 * - Show mention count badges
 * - Support list and grid view modes
 * - Clickable items that trigger onConceptClick
 * - Selected state highlighting
 * - Loading skeleton state
 * - Empty state when no concepts
 *
 * @example
 * <ConceptListView
 *   concepts={concepts}
 *   viewMode="grid"
 *   onConceptClick={(id) => console.log('Concept clicked:', id)}
 *   selectedConceptId={selectedId}
 * />
 */
export function ConceptListView({
  concepts,
  onConceptClick,
  selectedConceptId,
  isLoading = false,
  className,
  viewMode = 'list',
}: ConceptListViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['tool', 'process', 'technical_term'])
  );

  // Group concepts by type
  const groupedConcepts = useMemo(() => {
    const groups: Record<ConceptType, typeof concepts> = {
      tool: [],
      process: [],
      technical_term: [],
      person: [],
      organization: [],
      general: [],
    };

    concepts.forEach((concept) => {
      const type = concept.conceptType || 'general';
      if (groups[type]) {
        groups[type].push(concept);
      } else {
        groups.general.push(concept);
      }
    });

    // Return only non-empty groups, sorted by priority
    const sortOrder: ConceptType[] = [
      'tool',
      'process',
      'technical_term',
      'person',
      'organization',
      'general',
    ];

    return sortOrder
      .filter((type) => groups[type].length > 0)
      .map((type) => ({
        type,
        concepts: groups[type],
        count: groups[type].length,
      }));
  }, [concepts]);

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <ConceptListViewSkeleton viewMode={viewMode} />
      </div>
    );
  }

  // Empty state
  if (concepts.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center py-12 px-4',
          className
        )}
      >
        <div className="inline-flex items-center justify-center rounded-full bg-muted p-4 mb-4">
          <Brain className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Concepts Found</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          No concepts have been detected in your content yet. Add more content to start building
          your knowledge graph.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4" />
          <span>Concepts will appear here as they&apos;re extracted from your content</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groupedConcepts.map(({ type, concepts: groupConcepts, count }) => (
        <ConceptGroup
          key={type}
          type={type}
          concepts={groupConcepts}
          count={count}
          isExpanded={expandedGroups.has(type)}
          onToggle={() => toggleGroup(type)}
          onConceptClick={onConceptClick}
          selectedConceptId={selectedConceptId}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}

/**
 * ConceptGroup - A collapsible group of concepts by type
 */
interface ConceptGroupProps {
  type: ConceptType;
  concepts: Array<{
    id: string;
    name: string;
    conceptType: ConceptType;
    mentionCount: number;
    description?: string | null;
  }>;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  onConceptClick?: (conceptId: string) => void;
  selectedConceptId?: string | null;
  viewMode: 'list' | 'grid';
}

function ConceptGroup({
  type,
  concepts,
  count,
  isExpanded,
  onToggle,
  onConceptClick,
  selectedConceptId,
  viewMode,
}: ConceptGroupProps) {
  const color = CONCEPT_TYPE_COLORS[type];

  return (
    <div className="space-y-3">
      {/* Group Header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full group hover:opacity-80 transition-opacity min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${type.replace('_', ' ')} concepts group`}
      >
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        )}
        <ConceptTypeLabel type={type} size="md" />
        <div
          className="h-px flex-1 mx-2"
          style={{ backgroundColor: color, opacity: 0.2 }}
          aria-hidden="true"
        />
        <span className="text-sm text-muted-foreground font-medium">
          {count} {count === 1 ? 'concept' : 'concepts'}
        </span>
      </button>

      {/* Group Content */}
      {isExpanded && (
        <div
          className={cn(
            'pl-6',
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
              : 'space-y-2'
          )}
        >
          {concepts.map((concept) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              onClick={onConceptClick ? () => onConceptClick(concept.id) : undefined}
              isSelected={selectedConceptId === concept.id}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ConceptCard - Individual concept display card
 */
interface ConceptCardProps {
  concept: {
    id: string;
    name: string;
    conceptType: ConceptType;
    mentionCount: number;
    description?: string | null;
  };
  onClick?: () => void;
  isSelected: boolean;
  viewMode: 'list' | 'grid';
}

function ConceptCard({ concept, onClick, isSelected, viewMode }: ConceptCardProps) {
  const color = CONCEPT_TYPE_COLORS[concept.conceptType];

  if (viewMode === 'grid') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex flex-col items-start p-3 rounded-lg border transition-all text-left min-h-[80px]',
          'hover:border-foreground/20 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          isSelected
            ? 'border-foreground/40 bg-muted/50 ring-2 ring-offset-2 ring-foreground/10'
            : 'border-border bg-card',
          onClick && 'cursor-pointer'
        )}
        aria-label={`${concept.name} concept, ${concept.mentionCount} mentions`}
        aria-pressed={isSelected}
      >
        <div className="flex items-start justify-between w-full gap-2 mb-2">
          <h4 className="font-medium text-sm line-clamp-2 flex-1">{concept.name}</h4>
          <span
            className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-xs font-medium px-2 py-0.5"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
            aria-label={`${concept.mentionCount} mentions`}
          >
            {concept.mentionCount}
          </span>
        </div>
        {concept.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{concept.description}</p>
        )}
      </button>
    );
  }

  // List view
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-2.5 rounded-lg border transition-all w-full text-left min-h-[44px]',
        'hover:border-foreground/20 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isSelected
          ? 'border-foreground/40 bg-muted/50 ring-2 ring-offset-2 ring-foreground/10'
          : 'border-border bg-card',
        onClick && 'cursor-pointer'
      )}
      aria-label={`${concept.name} concept, ${concept.mentionCount} mentions`}
      aria-pressed={isSelected}
    >
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate mb-0.5">{concept.name}</h4>
        {concept.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{concept.description}</p>
        )}
      </div>
      <span
        className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-xs font-medium px-2.5 py-1"
        style={{
          backgroundColor: `${color}20`,
          color: color,
        }}
        aria-label={`${concept.mentionCount} mentions`}
      >
        {concept.mentionCount} mention{concept.mentionCount !== 1 ? 's' : ''}
      </span>
    </button>
  );
}

/**
 * ConceptListViewSkeleton - Loading skeleton for ConceptListView
 */
interface ConceptListViewSkeletonProps {
  viewMode?: 'list' | 'grid';
  groupCount?: number;
  itemsPerGroup?: number;
}

export function ConceptListViewSkeleton({
  viewMode = 'list',
  groupCount = 3,
  itemsPerGroup = 4,
}: ConceptListViewSkeletonProps) {
  return (
    <div className="space-y-6">
      {Array.from({ length: groupCount }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          {/* Group Header Skeleton */}
          <div className="flex items-center gap-2">
            <div className="size-4 bg-muted rounded animate-pulse" />
            <div className="h-5 w-24 bg-muted rounded animate-pulse" />
            <div className="h-px flex-1 bg-muted animate-pulse" />
            <div className="h-5 w-16 bg-muted rounded animate-pulse" />
          </div>

          {/* Group Items Skeleton */}
          <div
            className={cn(
              'pl-6',
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
                : 'space-y-2'
            )}
          >
            {Array.from({ length: itemsPerGroup }).map((_, itemIndex) => (
              <div
                key={itemIndex}
                className={cn(
                  viewMode === 'grid' ? 'h-24' : 'h-16',
                  'rounded-lg bg-muted animate-pulse'
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ConceptListViewHeader - Optional header with view mode toggle
 */
interface ConceptListViewHeaderProps {
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  conceptCount: number;
  className?: string;
}

export function ConceptListViewHeader({
  viewMode,
  onViewModeChange,
  conceptCount,
  className,
}: ConceptListViewHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-2">
        <Brain className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Concepts</h2>
        <span className="text-sm text-muted-foreground">({conceptCount})</span>
      </div>

      <div className="flex items-center gap-1 border rounded-lg p-1">
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('list')}
          className="h-7 px-2"
          aria-label="List view"
        >
          <LayoutList className="size-4" />
        </Button>
        <Button
          variant={viewMode === 'grid' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('grid')}
          className="h-7 px-2"
          aria-label="Grid view"
        >
          <LayoutGrid className="size-4" />
        </Button>
      </div>
    </div>
  );
}

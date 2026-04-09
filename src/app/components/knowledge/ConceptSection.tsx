'use client';

import * as React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ConceptBadge, ConceptList, ConceptTypeLabel } from './ConceptBadge';
import type { ConceptType } from '@/lib/validations/knowledge';

interface Concept {
  id: string;
  name: string;
  conceptType: ConceptType;
  mentionCount?: number;
  description?: string | null;
}

interface ConceptSectionProps {
  concepts: Concept[];
  isLoading?: boolean;
  error?: string | null;
  onConceptClick?: (conceptId: string) => void;
  className?: string;
  title?: string;
  showGrouping?: boolean;
  maxVisible?: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * ConceptSection - Display concepts in a sidebar section
 *
 * Features:
 * - Groups concepts by type (tool, process, technical_term, etc.)
 * - Collapsible groups
 * - Loading state
 * - Empty state
 * - Click handler for concept details
 */
export function ConceptSection({
  concepts,
  isLoading = false,
  error,
  onConceptClick,
  className,
  title = 'Concepts',
  showGrouping = true,
  maxVisible = 10,
  collapsible = true,
  defaultExpanded = true,
}: ConceptSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['tool', 'process', 'technical_term']));

  // Group concepts by type
  const groupedConcepts = React.useMemo(() => {
    if (!showGrouping) return null;

    const groups: Record<ConceptType, Concept[]> = {
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
    const sortOrder: ConceptType[] = ['tool', 'process', 'technical_term', 'person', 'organization', 'general'];
    return sortOrder
      .filter((type) => groups[type].length > 0)
      .map((type) => ({ type, concepts: groups[type] }));
  }, [concepts, showGrouping]);

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
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (concepts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>No concepts detected yet</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {collapsible ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 hover:text-foreground/80 transition-colors w-full text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              <Brain className="h-4 w-4" aria-hidden="true" />
              {title}
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {concepts.length}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" aria-hidden="true" />
              {title}
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {concepts.length}
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      {(!collapsible || isExpanded) && (
        <CardContent className="space-y-4">
          {showGrouping && groupedConcepts ? (
            // Grouped view
            groupedConcepts.map(({ type, concepts: groupConcepts }) => (
              <ConceptGroup
                key={type}
                type={type}
                concepts={groupConcepts}
                isExpanded={expandedGroups.has(type)}
                onToggle={() => toggleGroup(type)}
                onConceptClick={onConceptClick}
                maxVisible={maxVisible}
              />
            ))
          ) : (
            // Flat view
            <ConceptList
              concepts={concepts}
              size="sm"
              showIcon
              maxVisible={maxVisible}
              onConceptClick={onConceptClick}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * ConceptGroup - A collapsible group of concepts by type
 */
interface ConceptGroupProps {
  type: ConceptType;
  concepts: Concept[];
  isExpanded: boolean;
  onToggle: () => void;
  onConceptClick?: (conceptId: string) => void;
  maxVisible?: number;
}

function ConceptGroup({
  type,
  concepts,
  isExpanded,
  onToggle,
  onConceptClick,
  maxVisible = 5,
}: ConceptGroupProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-sm hover:text-foreground/80 transition-colors w-full text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${type.replace('_', ' ')} concepts`}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        )}
        <ConceptTypeLabel type={type} size="sm" />
        <span className="ml-auto text-xs text-muted-foreground">
          {concepts.length}
        </span>
      </button>

      {isExpanded && (
        <div className="ml-4">
          <ConceptList
            concepts={concepts}
            size="sm"
            showIcon={false}
            maxVisible={maxVisible}
            onConceptClick={onConceptClick}
          />
        </div>
      )}
    </div>
  );
}

/**
 * ConceptSectionCompact - A more compact version for cards
 */
interface ConceptSectionCompactProps {
  concepts: Concept[];
  onConceptClick?: (conceptId: string) => void;
  maxVisible?: number;
  className?: string;
}

export function ConceptSectionCompact({
  concepts,
  onConceptClick,
  maxVisible = 3,
  className,
}: ConceptSectionCompactProps) {
  if (concepts.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      <ConceptList
        concepts={concepts}
        size="sm"
        showIcon
        maxVisible={maxVisible}
        onConceptClick={onConceptClick}
      />
    </div>
  );
}

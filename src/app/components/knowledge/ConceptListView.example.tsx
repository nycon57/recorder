/**
 * ConceptListView Usage Examples
 *
 * This file demonstrates how to use the ConceptListView component
 * with different configurations.
 */

'use client';

import { useState } from 'react';

import {
  ConceptListView,
  ConceptListViewSkeleton,
  ConceptListViewHeader,
} from './ConceptListView';
import type { ConceptType } from '@/lib/validations/knowledge';

// Example: Basic usage with list view
export function BasicListExample() {
  const concepts = [
    {
      id: '1',
      name: 'React',
      conceptType: 'tool' as ConceptType,
      mentionCount: 15,
      description: 'A JavaScript library for building user interfaces',
    },
    {
      id: '2',
      name: 'Next.js',
      conceptType: 'tool' as ConceptType,
      mentionCount: 12,
      description: 'The React Framework for Production',
    },
    {
      id: '3',
      name: 'Authentication Flow',
      conceptType: 'process' as ConceptType,
      mentionCount: 8,
      description: 'User login and authentication process',
    },
  ];

  return (
    <ConceptListView
      concepts={concepts}
      viewMode="list"
      onConceptClick={(id) => console.log('Concept clicked:', id)}
    />
  );
}

// Example: Grid view with selection
export function GridViewWithSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const concepts = [
    {
      id: '1',
      name: 'TypeScript',
      conceptType: 'technical_term' as ConceptType,
      mentionCount: 20,
      description: 'Typed superset of JavaScript',
    },
    {
      id: '2',
      name: 'John Doe',
      conceptType: 'person' as ConceptType,
      mentionCount: 5,
      description: 'Lead Developer',
    },
    {
      id: '3',
      name: 'Acme Corp',
      conceptType: 'organization' as ConceptType,
      mentionCount: 3,
      description: 'Technology company',
    },
  ];

  return (
    <ConceptListView
      concepts={concepts}
      viewMode="grid"
      selectedConceptId={selectedId}
      onConceptClick={setSelectedId}
    />
  );
}

// Example: With header and view mode toggle
export function WithHeader() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const concepts = [
    {
      id: '1',
      name: 'Docker',
      conceptType: 'tool' as ConceptType,
      mentionCount: 10,
      description: 'Platform for developing, shipping, and running applications',
    },
    {
      id: '2',
      name: 'CI/CD Pipeline',
      conceptType: 'process' as ConceptType,
      mentionCount: 7,
      description: 'Continuous integration and deployment workflow',
    },
  ];

  return (
    <div className="space-y-4">
      <ConceptListViewHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        conceptCount={concepts.length}
      />

      <ConceptListView
        concepts={concepts}
        viewMode={viewMode}
        onConceptClick={(id) => console.log('Concept clicked:', id)}
      />
    </div>
  );
}

// Example: Loading state
export function LoadingState() {
  return (
    <ConceptListView
      concepts={[]}
      viewMode="list"
      isLoading={true}
    />
  );
}

// Example: Empty state
export function EmptyState() {
  return (
    <ConceptListView
      concepts={[]}
      viewMode="list"
      isLoading={false}
    />
  );
}

// Example: Custom skeleton
export function CustomSkeleton() {
  return (
    <ConceptListViewSkeleton
      viewMode="grid"
      groupCount={4}
      itemsPerGroup={6}
    />
  );
}

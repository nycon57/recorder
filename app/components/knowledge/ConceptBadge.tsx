'use client';

import React from 'react';
import {
  Wrench,
  GitBranch,
  User,
  Building,
  Code,
  Lightbulb,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ColoredBadge,
  ColoredBadgeList,
  type ColoredBadgeProps,
} from '@/app/components/ui/colored-badge';
import {
  type ConceptType,
  CONCEPT_TYPE_COLORS,
} from '@/lib/validations/knowledge';

/**
 * Icon mapping for concept types
 */
const ConceptTypeIcons: Record<
  ConceptType,
  React.ComponentType<{ className?: string }>
> = {
  tool: Wrench,
  process: GitBranch,
  person: User,
  organization: Building,
  technical_term: Code,
  general: Lightbulb,
};

/**
 * ConceptBadge - Display a concept with type-specific icon and color
 *
 * Built on ColoredBadge foundation for consistent styling and accessibility.
 *
 * @param concept - Concept object with name and type
 * @param name - Concept name to display (alternative to concept object)
 * @param type - Concept type (alternative to concept object)
 * @param size - Size variant (sm, md, lg)
 * @param showIcon - Show type icon (default: true)
 * @param removable - Show remove button
 * @param onRemove - Callback when remove is clicked
 * @param onClick - Callback when badge is clicked
 */
export interface ConceptBadgeProps
  extends Omit<ColoredBadgeProps, 'color' | 'icon' | 'removable'> {
  /** Concept object with name and type */
  concept?: {
    id?: string;
    name: string;
    conceptType: ConceptType;
  };
  /** Concept name to display (alternative to concept object) */
  name?: string;
  /** Concept type (alternative to concept object) */
  type?: ConceptType;
  /** Show type icon (default: true) */
  showIcon?: boolean;
  /** Show remove button */
  removable?: boolean;
}

export function ConceptBadge({
  concept,
  name: propName,
  type: propType = 'general',
  size = 'md',
  showIcon = true,
  removable = false,
  onRemove,
  className,
  onClick,
  ...props
}: ConceptBadgeProps) {
  // Support both concept object and individual props
  const name = concept?.name || propName || '';
  const conceptType = concept?.conceptType || propType;
  const color = CONCEPT_TYPE_COLORS[conceptType];
  const Icon = ConceptTypeIcons[conceptType];

  return (
    <ColoredBadge
      color={color}
      size={size}
      icon={showIcon && Icon ? <Icon className="size-full" /> : undefined}
      removable={removable}
      onRemove={onRemove}
      onClick={onClick}
      className={className}
      {...props}
    >
      {name}
    </ColoredBadge>
  );
}

/**
 * ConceptList - Display a list of concepts
 */
export interface ConceptListProps {
  concepts: Array<{
    id: string;
    name: string;
    conceptType: ConceptType;
  }>;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  removable?: boolean;
  onRemove?: (conceptId: string) => void;
  onConceptClick?: (conceptId: string) => void;
  className?: string;
  maxVisible?: number;
}

export function ConceptList({
  concepts,
  size = 'md',
  showIcon = true,
  removable = false,
  onRemove,
  onConceptClick,
  className,
  maxVisible = 5,
}: ConceptListProps) {
  // Convert concepts to ColoredBadgeList format
  const items = concepts.map((concept) => {
    const Icon = ConceptTypeIcons[concept.conceptType];
    return {
      id: concept.id,
      name: concept.name,
      color: CONCEPT_TYPE_COLORS[concept.conceptType],
      icon: showIcon && Icon ? <Icon className="size-full" /> : undefined,
    };
  });

  return (
    <ColoredBadgeList
      items={items}
      size={size}
      removable={removable}
      onRemove={onRemove}
      onItemClick={onConceptClick}
      maxVisible={maxVisible}
      className={className}
    />
  );
}

/**
 * ConceptTypeLabel - Display a concept type as a label
 */
export interface ConceptTypeLabelProps {
  type: ConceptType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConceptTypeLabel({
  type,
  size = 'md',
  className,
}: ConceptTypeLabelProps) {
  const Icon = ConceptTypeIcons[type];
  const color = CONCEPT_TYPE_COLORS[type];

  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const iconSizes = {
    sm: 'size-3',
    md: 'size-3.5',
    lg: 'size-4',
  };

  // Format type for display
  const formatType = (t: string) =>
    t
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium capitalize',
        sizeClasses[size],
        className
      )}
      style={{ color }}
    >
      {Icon && <Icon className={iconSizes[size]} />}
      <span>{formatType(type)}</span>
    </span>
  );
}

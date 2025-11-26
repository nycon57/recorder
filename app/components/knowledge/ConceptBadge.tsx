'use client';

import React from 'react';
import {
  Wrench,
  GitBranch,
  User,
  Building,
  Code,
  Lightbulb,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  type ConceptType,
  CONCEPT_TYPE_COLORS,
} from '@/lib/validations/knowledge';

/**
 * Icon mapping for concept types
 */
const ConceptTypeIcons: Record<ConceptType, React.ComponentType<{ className?: string }>> = {
  tool: Wrench,
  process: GitBranch,
  person: User,
  organization: Building,
  technical_term: Code,
  general: Lightbulb,
};

interface ConceptBadgeProps {
  concept?: {
    id?: string;
    name: string;
    conceptType: ConceptType;
  };
  name?: string;
  type?: ConceptType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  onClick?: () => void;
}

/**
 * ConceptBadge - Display a concept with type-specific icon and color
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
}: ConceptBadgeProps) {
  // Support both concept object and individual props
  const name = concept?.name || propName || '';
  const conceptType = concept?.conceptType || propType;
  const color = CONCEPT_TYPE_COLORS[conceptType];
  const Icon = ConceptTypeIcons[conceptType];

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  // Calculate text color based on background color (memoized)
  const textColor = React.useMemo(() => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }, [color]);

  // Determine if badge should be interactive (clickable but not removable)
  const isInteractive = onClick && !removable;

  // Keyboard handler for accessible button behavior
  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ') {
        e.preventDefault(); // Prevent page scroll on Space
      }
      onClick?.();
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-all',
        sizeClasses[size],
        isInteractive && 'cursor-pointer hover:opacity-80',
        className
      )}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {showIcon && Icon && <Icon className={iconSizes[size]} />}
      <span className="truncate max-w-[150px]">{name}</span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'ml-0.5 -mr-1 rounded-full hover:bg-black/10 transition-colors',
            size === 'sm' && 'p-0.5',
            size === 'md' && 'p-0.5',
            size === 'lg' && 'p-1'
          )}
          aria-label={`Remove ${name} concept`}
        >
          <X className={iconSizes[size]} />
        </button>
      )}
    </span>
  );
}

/**
 * ConceptList - Display a list of concepts grouped or flat
 */
interface ConceptListProps {
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
  const visibleConcepts = maxVisible ? concepts.slice(0, maxVisible) : concepts;
  const hiddenCount = concepts.length - visibleConcepts.length;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleConcepts.map((concept) => (
        <ConceptBadge
          key={concept.id}
          name={concept.name}
          type={concept.conceptType}
          size={size}
          showIcon={showIcon}
          removable={removable}
          onRemove={onRemove ? () => onRemove(concept.id) : undefined}
          onClick={onConceptClick ? () => onConceptClick(concept.id) : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded-full bg-muted text-muted-foreground',
            size === 'sm' && 'text-xs px-2 py-0.5',
            size === 'md' && 'text-sm px-2.5 py-1',
            size === 'lg' && 'text-base px-3 py-1.5'
          )}
        >
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}

/**
 * ConceptTypeLabel - Display a concept type as a label
 */
interface ConceptTypeLabelProps {
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
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
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

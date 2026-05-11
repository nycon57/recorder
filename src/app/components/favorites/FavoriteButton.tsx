'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { m } from 'motion/react';

import { Button } from '@/app/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from '@/app/components/ui/use-toast';

interface FavoriteButtonProps {
  recordingId: string;
  isFavorite: boolean;
  onToggle?: (newState: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

interface FavoriteButtonState {
  isFavorite: boolean;
  isFavoritePending: boolean;
  isAnimating: boolean;
}

type FavoriteButtonAction =
  | { type: 'start-toggle'; nextFavorite: boolean }
  | { type: 'toggle-succeeded' }
  | { type: 'toggle-failed'; previousFavorite: boolean }
  | { type: 'animation-finished' };

function createFavoriteState(isFavorite: boolean): FavoriteButtonState {
  return {
    isFavorite,
    isFavoritePending: false,
    isAnimating: false,
  };
}

function favoriteButtonReducer(
  state: FavoriteButtonState,
  action: FavoriteButtonAction,
): FavoriteButtonState {
  switch (action.type) {
    case 'start-toggle':
      return {
        isFavorite: action.nextFavorite,
        isFavoritePending: true,
        isAnimating: true,
      };
    case 'toggle-succeeded':
      return {
        ...state,
        isFavoritePending: false,
      };
    case 'toggle-failed':
      return {
        isFavorite: action.previousFavorite,
        isFavoritePending: false,
        isAnimating: false,
      };
    case 'animation-finished':
      return {
        ...state,
        isAnimating: false,
      };
    default:
      return state;
  }
}

/**
 * FavoriteButton Component
 * Star/unstar toggle button with animation
 *
 * Features:
 * - Animated star icon
 * - Loading state
 * - Accessible with tooltip
 * - Multiple sizes
 * - Optional label
 *
 * Usage:
 * <FavoriteButton
 *   isFavorite={item.is_favorite}
 *   onToggle={handleToggleFavorite}
 * />
 */
export function FavoriteButton({
  recordingId,
  isFavorite: initialFavorite,
  ...props
}: FavoriteButtonProps) {
  return (
    <FavoriteButtonContent
      key={`${recordingId}:${initialFavorite ? 'favorite' : 'not-favorite'}`}
      recordingId={recordingId}
      isFavorite={initialFavorite}
      {...props}
    />
  );
}

function FavoriteButtonContent({
  recordingId,
  isFavorite: initialFavorite,
  onToggle,
  size = 'md',
  showLabel = false,
  disabled = false,
  className,
}: FavoriteButtonProps) {
  const [state, dispatch] = React.useReducer(
    favoriteButtonReducer,
    initialFavorite,
    createFavoriteState,
  );
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const { isFavorite, isFavoritePending, isAnimating } = state;

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isFavoritePending || disabled) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Optimistic update
    const newState = !isFavorite;
    dispatch({ type: 'start-toggle', nextFavorite: newState });

    try {
      const endpoint = newState
        ? '/api/favorites'
        : `/api/favorites/${recordingId}`;

      const response = await fetch(endpoint, {
        method: newState ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        ...(newState && {
          body: JSON.stringify({ recording_id: recordingId }),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }

      onToggle?.(newState);
      toast({
        description: newState ? 'Added to favorites' : 'Removed from favorites',
      });

      timeoutRef.current = setTimeout(() => {
        dispatch({ type: 'animation-finished' });
      }, 300);
      dispatch({ type: 'toggle-succeeded' });
    } catch (error) {
      // Revert on error
      dispatch({ type: 'toggle-failed', previousFavorite: !newState });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update favorite status',
      });
      console.error('Failed to toggle favorite:', error);
    }
  };

  const sizeClasses = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-6',
  };

  const button = (
    <Button
      variant="ghost"
      size={
        showLabel
          ? 'sm'
          : size === 'sm'
            ? 'icon-sm'
            : size === 'lg'
              ? 'icon-lg'
              : 'icon'
      }
      onClick={handleFavoriteToggle}
      disabled={disabled || isFavoritePending}
      className={cn('shrink-0', isAnimating && 'animate-pulse', className)}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorite}
    >
      <m.div
        initial={false}
        animate={{
          scale: isAnimating ? [1, 1.2, 1] : 1,
          rotate: isAnimating && isFavorite ? [0, 15, -15, 0] : 0,
        }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut',
        }}
      >
        <Star
          className={cn(
            sizeClasses[size],
            'transition-all duration-200',
            isFavorite &&
              'fill-yellow-400 text-yellow-400 dark:fill-yellow-500 dark:text-yellow-500',
            !isFavorite && 'text-muted-foreground hover:text-yellow-400',
          )}
        />
      </m.div>
      {showLabel && (
        <span className="ml-2">{isFavorite ? 'Favorited' : 'Favorite'}</span>
      )}
    </Button>
  );

  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

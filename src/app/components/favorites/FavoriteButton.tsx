'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';
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
  onToggle,
  size = 'md',
  showLabel = false,
  disabled = false,
  className,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = React.useState(initialFavorite);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setIsFavorite(initialFavorite);
  }, [initialFavorite]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isLoading || disabled) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Optimistic update
    const newState = !isFavorite;
    setIsFavorite(newState);
    setIsLoading(true);
    setIsAnimating(true);

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

      timeoutRef.current = setTimeout(() => setIsAnimating(false), 300);
    } catch (error) {
      // Revert on error
      setIsFavorite(!newState);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update favorite status',
      });
      console.error('Failed to toggle favorite:', error);
      setIsAnimating(false);
    } finally {
      setIsLoading(false);
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
      size={showLabel ? 'sm' : size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon'}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={cn(
        'shrink-0',
        isAnimating && 'animate-pulse',
        className
      )}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorite}
    >
      <motion.div
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
            isFavorite && 'fill-yellow-400 text-yellow-400 dark:fill-yellow-500 dark:text-yellow-500',
            !isFavorite && 'text-muted-foreground hover:text-yellow-400'
          )}
        />
      </motion.div>
      {showLabel && (
        <span className="ml-2">
          {isFavorite ? 'Favorited' : 'Favorite'}
        </span>
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

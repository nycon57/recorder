'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';

import { cn } from '@/lib/utils';

/**
 * ContentModal - Brand-styled modal component with frosted glass effects
 *
 * Extends the base Dialog with Tribora brand patterns:
 * - Frosted glass background (backdrop-blur)
 * - Subtle accent glow on hover/focus
 * - Consistent sizing variants
 * - Premium animation with var(--ease-smooth)
 *
 * Use this for content display modals (previews, details, confirmations).
 * For form-based modals with mutation handling, use FormDialog instead.
 *
 * @example
 * ```tsx
 * <ContentModal open={open} onOpenChange={setOpen}>
 *   <ContentModalHeader>
 *     <ContentModalTitle>Content Title</ContentModalTitle>
 *     <ContentModalDescription>Optional description</ContentModalDescription>
 *   </ContentModalHeader>
 *   <ContentModalBody>
 *     <p>Modal content goes here</p>
 *   </ContentModalBody>
 *   <ContentModalFooter>
 *     <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
 *     <Button onClick={handleAction}>Confirm</Button>
 *   </ContentModalFooter>
 * </ContentModal>
 * ```
 */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-[90vw]',
};

interface ContentModalProps {
  /** Controls the open/closed state of the modal */
  open: boolean;
  /** Callback when the modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Size variant for the modal (default: "lg") */
  size?: ModalSize;
  /** Enable frosted glass effect (default: true) */
  glass?: boolean;
  /** Show subtle glow effect (default: true) */
  glow?: boolean;
  /** Show close button (default: true) */
  showCloseButton?: boolean;
  /** Additional className for content */
  className?: string;
  /** Modal content */
  children: React.ReactNode;
}

const ContentModal = React.forwardRef<HTMLDivElement, ContentModalProps>(
  (
    {
      open,
      onOpenChange,
      size = 'lg',
      glass = true,
      glow = true,
      showCloseButton = true,
      className,
      children,
    },
    ref
  ) => {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          {/* Overlay with brand-consistent blur */}
          <DialogPrimitive.Overlay
            className={cn(
              'fixed inset-0 z-50',
              'bg-black/60 backdrop-blur-sm',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
            )}
          />

          {/* Content with brand styling */}
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              // Position and sizing
              'fixed left-[50%] top-[50%] z-50 w-full translate-x-[-50%] translate-y-[-50%]',
              sizeClasses[size],
              'max-h-[90vh] overflow-hidden',

              // Base styling
              'rounded-xl border shadow-2xl',

              // Frosted glass effect
              glass && [
                'bg-card/95 backdrop-blur-xl',
                'border-border/50',
              ],

              // Non-glass fallback
              !glass && 'bg-card border-border',

              // Glow effect on focus-within
              glow && [
                'transition-shadow duration-200',
                'focus-within:shadow-[0_0_30px_rgba(0,223,130,0.15)]',
              ],

              // Animations using brand easing
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4',
              'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
              'duration-200',

              className
            )}
          >
            {children}

            {showCloseButton && (
              <DialogPrimitive.Close
                className={cn(
                  'absolute right-4 top-4',
                  'rounded-sm p-1',
                  'opacity-70 ring-offset-background',
                  'transition-all duration-150',
                  'hover:opacity-100 hover:bg-muted/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:pointer-events-none'
                )}
              >
                <Cross2Icon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }
);
ContentModal.displayName = 'ContentModal';

/**
 * ContentModalHeader - Header section for ContentModal
 */
const ContentModalHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col gap-1.5 p-6 pb-0',
      'text-center sm:text-left',
      className
    )}
    {...props}
  />
);
ContentModalHeader.displayName = 'ContentModalHeader';

/**
 * ContentModalTitle - Title for ContentModal
 */
const ContentModalTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
ContentModalTitle.displayName = 'ContentModalTitle';

/**
 * ContentModalDescription - Description for ContentModal
 */
const ContentModalDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
ContentModalDescription.displayName = 'ContentModalDescription';

/**
 * ContentModalBody - Main content area for ContentModal
 * Includes overflow handling for long content
 */
const ContentModalBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'p-6 overflow-y-auto max-h-[60vh]',
      className
    )}
    {...props}
  />
);
ContentModalBody.displayName = 'ContentModalBody';

/**
 * ContentModalFooter - Footer section for ContentModal
 * Typically contains action buttons
 */
const ContentModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 p-6 pt-0',
      'sm:flex-row sm:justify-end',
      'border-t border-border/50 mt-4 pt-4',
      className
    )}
    {...props}
  />
);
ContentModalFooter.displayName = 'ContentModalFooter';

export {
  ContentModal,
  ContentModalHeader,
  ContentModalTitle,
  ContentModalDescription,
  ContentModalBody,
  ContentModalFooter,
  type ContentModalProps,
  type ModalSize,
};

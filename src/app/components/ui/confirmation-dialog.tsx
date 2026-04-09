'use client';

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Label } from '@/app/components/ui/label';

/**
 * Warning configuration for destructive actions
 */
export interface ConfirmationWarning {
  /** Warning title */
  title?: string;
  /** Warning description/message */
  message: string;
  /** Show warning as destructive (red) */
  variant?: 'default' | 'destructive';
}

/**
 * Props for ConfirmationDialog component
 */
export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description */
  description?: string;
  /** Confirmation button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Whether the confirmation action is loading */
  isLoading?: boolean;
  /** Whether to show a destructive variant */
  variant?: 'default' | 'destructive';
  /**
   * Require typing exact text to confirm
   * If string: user must type this exact text
   * If true: uses confirmText as required text
   */
  requireTypedConfirmation?: boolean | string;
  /** Warning messages to display */
  warnings?: ConfirmationWarning[];
  /** Use AlertDialog instead of Dialog (more semantic for confirmations) */
  useAlertDialog?: boolean;
}

/**
 * ConfirmationDialog - Reusable confirmation dialog with typed confirmation support
 *
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Delete Item"
 *   description="This action cannot be undone."
 *   onConfirm={handleDelete}
 *   variant="destructive"
 *   requireTypedConfirmation="DELETE"
 *   warnings={[{
 *     message: "This will permanently delete the item and all associated data."
 *   }]}
 * />
 * ```
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isLoading = false,
  variant = 'default',
  requireTypedConfirmation = false,
  warnings = [],
  useAlertDialog = false,
}: ConfirmationDialogProps) {
  const [typedText, setTypedText] = React.useState('');

  // Reset typed text when dialog closes
  React.useEffect(() => {
    if (!open) {
      setTypedText('');
    }
  }, [open]);

  // Determine required text for typed confirmation
  const requiredText = React.useMemo(() => {
    if (requireTypedConfirmation === true) {
      return confirmText;
    }
    if (typeof requireTypedConfirmation === 'string') {
      return requireTypedConfirmation;
    }
    return null;
  }, [requireTypedConfirmation, confirmText]);

  // Check if confirmation is disabled
  const isDisabled = React.useMemo(() => {
    if (isLoading) return true;
    if (requiredText && typedText !== requiredText) return true;
    return false;
  }, [isLoading, requiredText, typedText]);

  const handleConfirm = React.useCallback(async () => {
    if (isDisabled) return;
    await onConfirm();
  }, [isDisabled, onConfirm]);

  // Render warnings section
  const renderWarnings = () => {
    if (warnings.length === 0) return null;

    return (
      <div className="space-y-2">
        {warnings.map((warning, index) => (
          <Alert key={index} variant={warning.variant || 'default'}>
            <AlertTriangle className="h-4 w-4" />
            {warning.title && <AlertTitle>{warning.title}</AlertTitle>}
            <AlertDescription>{warning.message}</AlertDescription>
          </Alert>
        ))}
      </div>
    );
  };

  // Render typed confirmation input
  const renderTypedConfirmation = () => {
    if (!requiredText) return null;

    return (
      <div className="space-y-2">
        <Label htmlFor="confirm-text" className="text-sm font-medium">
          Type <strong className="font-semibold">{requiredText}</strong> to confirm:
        </Label>
        <Input
          id="confirm-text"
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder={requiredText}
          disabled={isLoading}
          autoComplete="off"
        />
      </div>
    );
  };

  // Use AlertDialog for more semantic confirmation dialogs
  if (useAlertDialog) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {renderWarnings()}
          {renderTypedConfirmation()}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isDisabled}
              className={variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Use regular Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {renderWarnings()}
        {renderTypedConfirmation()}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isDisabled}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

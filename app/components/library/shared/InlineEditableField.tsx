'use client';

import * as React from 'react';
import { Check, X, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/lib/utils';

interface InlineEditableFieldProps {
  /**
   * Current value of the field
   */
  value: string;

  /**
   * Callback when value is saved
   */
  onSave: (newValue: string) => Promise<void>;

  /**
   * Field label for accessibility
   */
  label?: string;

  /**
   * Placeholder text when empty
   */
  placeholder?: string;

  /**
   * Field type: single-line or multi-line
   */
  type?: 'text' | 'textarea';

  /**
   * Display style in read mode
   */
  displayAs?: 'title' | 'description' | 'text';

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Whether field is required
   */
  required?: boolean;

  /**
   * Max length for validation
   */
  maxLength?: number;
}

/**
 * InlineEditableField - Edit text fields directly without modal
 *
 * Features:
 * - Click to edit mode
 * - Save/cancel actions
 * - Loading state
 * - Validation support
 * - Keyboard shortcuts (Enter to save, Esc to cancel)
 *
 * @example
 * <InlineEditableField
 *   value={recording.title}
 *   onSave={async (newTitle) => {
 *     await updateRecording({ title: newTitle });
 *   }}
 *   displayAs="title"
 *   placeholder="Untitled"
 * />
 */
export default function InlineEditableField({
  value,
  onSave,
  label,
  placeholder = 'Click to edit',
  type = 'text',
  displayAs = 'text',
  className,
  required = false,
  maxLength,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Reset edit value when prop value changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing) {
      if (type === 'textarea') {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [isEditing, type]);

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();

    // Validation
    if (required && !trimmedValue) {
      setError('This field is required');
      return;
    }

    if (maxLength && trimmedValue.length > maxLength) {
      setError(`Maximum ${maxLength} characters allowed`);
      return;
    }

    // No change, just cancel
    if (trimmedValue === value) {
      handleCancel();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (type === 'text' || (type === 'textarea' && (e.metaKey || e.ctrlKey)))) {
      e.preventDefault();
      handleSave();
    }
  };

  // Display classes based on style
  const displayClasses = {
    title: 'text-2xl font-bold',
    description: 'text-sm text-muted-foreground',
    text: 'text-base',
  };

  if (isEditing) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <label className="text-xs font-medium text-muted-foreground">
            {label}
          </label>
        )}

        <div className="flex items-start gap-2">
          {type === 'textarea' ? (
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSaving}
              maxLength={maxLength}
              rows={4}
              className="flex-1"
            />
          ) : (
            <Input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSaving}
              maxLength={maxLength}
              className="flex-1"
            />
          )}

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving}
              title="Save (Enter)"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4 text-green-600" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
              title="Cancel (Esc)"
            >
              <X className="size-4 text-destructive" />
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {type === 'textarea' && maxLength && (
          <p className="text-xs text-muted-foreground text-right">
            {editValue.length} / {maxLength}
          </p>
        )}

        {type === 'textarea' && (
          <p className="text-xs text-muted-foreground">
            Press {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to save
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative inline-flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={handleEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEdit();
        }
      }}
      aria-label={label ? `Edit ${label}` : 'Edit field'}
    >
      <span className={cn(displayClasses[displayAs], !value && 'text-muted-foreground italic')}>
        {value || placeholder}
      </span>
      <Edit2 className="size-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
}

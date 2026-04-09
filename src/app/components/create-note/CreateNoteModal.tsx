'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FileTextIcon,
  FileEditIcon,
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface CreateNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated?: (noteId: string) => void;
}

type ContentFormat = 'plain' | 'markdown';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

/**
 * CreateNoteModal - Modal for creating text notes
 *
 * Supports both plain text and markdown formats
 * Validates input and submits to POST /api/library/text
 * Shows loading states and success/error feedback
 *
 * @example
 * ```tsx
 * <CreateNoteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onNoteCreated={(id) => console.log('Created:', id)}
 * />
 * ```
 */
export default function CreateNoteModal({
  isOpen,
  onClose,
  onNoteCreated,
}: CreateNoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<ContentFormat>('plain');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoCloseTimeout, setAutoCloseTimeout] = useState<NodeJS.Timeout | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    content?: string;
    description?: string;
  }>({});

  // Clear timeout on unmount or before setting a new one
  useEffect(() => {
    return () => {
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
      }
    };
  }, [autoCloseTimeout]);

  /**
   * Validate form inputs with field-level errors
   */
  const validateForm = useCallback((): boolean => {
    const errors: typeof fieldErrors = {};

    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.length > 200) {
      errors.title = 'Title must be 200 characters or less';
    }

    if (!content.trim()) {
      errors.content = 'Content is required';
    } else {
      const contentBytes = new TextEncoder().encode(content).length;
      if (contentBytes > 500000) {
        errors.content = `Content is too large (max 500KB, currently ${(contentBytes / 1024).toFixed(1)}KB)`;
      }
    }

    if (description.length > 2000) {
      errors.description = 'Description must be 2000 characters or less';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [title, content, description]);

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    // Validate inputs
    const isValid = validateForm();
    if (!isValid) {
      toast.error('Please fix validation errors before submitting');
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/library/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          format,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create note');
      }

      const { data } = await response.json();
      const noteId = data.id;

      setStatus('success');
      toast.success('Note created successfully!', {
        description: 'Your note is being processed and will appear in your library shortly.',
      });

      // Call completion handler
      if (onNoteCreated && noteId) {
        onNoteCreated(noteId);
      }

      // Reset form and close after brief delay
      const timeoutId = setTimeout(() => {
        handleClose();
        setAutoCloseTimeout(null);
      }, 1500);
      setAutoCloseTimeout(timeoutId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create note';
      setStatus('error');
      setErrorMessage(message);
      toast.error('Failed to create note', {
        description: message,
      });
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (status !== 'submitting') {
      // Clear any pending timeouts
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        setAutoCloseTimeout(null);
      }
      // Reset form
      setTitle('');
      setContent('');
      setFormat('plain');
      setDescription('');
      setStatus('idle');
      setErrorMessage(null);
      setFieldErrors({});
      onClose();
    }
  };

  /**
   * Check if form is valid
   */
  const isFormValid = title.trim() && content.trim();
  const isSubmitting = status === 'submitting';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="size-5 text-green-600 dark:text-green-400" />
            Create Note
          </DialogTitle>
          <DialogDescription>
            Create a new text note to add to your knowledge library.
            Notes can be plain text or markdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title Input */}
          <div className="space-y-2">
            <label htmlFor="note-title" className="text-sm font-medium text-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="note-title"
              placeholder="Enter note title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
              disabled={isSubmitting}
              maxLength={200}
              className={`w-full ${fieldErrors.title ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              autoFocus
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {title.length}/200 characters
              </p>
              {fieldErrors.title && (
                <p id="title-error" className="text-xs text-destructive" role="alert">
                  {fieldErrors.title}
                </p>
              )}
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label htmlFor="note-format" className="text-sm font-medium text-foreground">
              Format
            </label>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as ContentFormat)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="note-format" className="w-full">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="size-4" />
                    <span>Plain Text</span>
                  </div>
                </SelectItem>
                <SelectItem value="markdown">
                  <div className="flex items-center gap-2">
                    <FileEditIcon className="size-4" />
                    <span>Markdown</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {format === 'markdown'
                ? 'Markdown formatting will be preserved (e.g., **bold**, *italic*, # headings)'
                : 'Simple plain text without formatting'}
            </p>
          </div>

          {/* Content Textarea */}
          <div className="space-y-2">
            <label htmlFor="note-content" className="text-sm font-medium text-foreground">
              Content <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="note-content"
              placeholder={
                format === 'markdown'
                  ? '# My Note\n\nWrite your content here using **markdown** syntax...'
                  : 'Write your note content here...'
              }
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fieldErrors.content) {
                  setFieldErrors((prev) => ({ ...prev, content: undefined }));
                }
              }}
              disabled={isSubmitting}
              rows={10}
              className={`w-full font-mono text-sm resize-y min-h-[150px] sm:min-h-[200px] ${fieldErrors.content ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              aria-invalid={!!fieldErrors.content}
              aria-describedby={fieldErrors.content ? 'content-error' : undefined}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {(content.length / 1000).toFixed(1)}KB / 500KB
              </p>
              {fieldErrors.content && (
                <p id="content-error" className="text-xs text-destructive" role="alert">
                  {fieldErrors.content}
                </p>
              )}
            </div>
          </div>

          {/* Description Input (Optional) */}
          <div className="space-y-2">
            <label htmlFor="note-description" className="text-sm font-medium text-foreground">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="note-description"
              placeholder="Add a brief description or summary (optional)"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => ({ ...prev, description: undefined }));
                }
              }}
              disabled={isSubmitting}
              rows={2}
              maxLength={2000}
              className={`w-full resize-y ${fieldErrors.description ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              aria-invalid={!!fieldErrors.description}
              aria-describedby={fieldErrors.description ? 'description-error' : undefined}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {description.length}/2000 characters
              </p>
              {fieldErrors.description && (
                <p id="description-error" className="text-xs text-destructive" role="alert">
                  {fieldErrors.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {status === 'error' && errorMessage && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <XCircleIcon className="size-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">
                Error
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {status === 'success' && (
          <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle2Icon className="size-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Note Created
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Your note has been created and is being processed.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[40px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[40px]"
          >
            {isSubmitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FileTextIcon className="size-4" />
                Create Note
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
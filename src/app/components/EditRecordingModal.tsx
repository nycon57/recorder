'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { editRecordingFormSchema } from '@/lib/validations/api';

import { FormDialog } from '@/app/components/ui/form-dialog';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import type { Tag } from '@/lib/types/database';

import TagInput from './TagInput';

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
}

interface EditRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: Recording;
  initialTags?: Tag[];
  onTagsChange?: (tags: Tag[]) => void;
  onRecordingUpdated?: () => void;
}

export default function EditRecordingModal({
  open,
  onOpenChange,
  recording,
  initialTags = [],
  onTagsChange,
  onRecordingUpdated,
}: EditRecordingModalProps) {
  const [tags, setTags] = React.useState<Tag[]>(initialTags);

  // Update tags when initialTags changes
  React.useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const handleTagsChange = (newTags: Tag[]) => {
    setTags(newTags);
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  const handleSubmit = async (data: { title: string; description?: string }) => {
    const response = await fetch(`/api/recordings/${recording.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title.trim(),
        description: data.description?.trim() || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update recording');
    }

    return response.json();
  };

  const handleSuccess = () => {
    toast.success('Recording updated successfully');

    // Notify parent
    if (onRecordingUpdated) {
      onRecordingUpdated();
    } else {
      // Refresh page if no callback provided
      window.location.reload();
    }
  };

  const handleCleanup = () => {
    setTags(initialTags);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Recording"
      description="Update the title and description for this recording."
      size="md"
      schema={editRecordingFormSchema as any}
      defaultValues={{
        title: recording.title || '',
        description: recording.description || '',
      }}
      mutationFn={handleSubmit}
      successMessage="Recording updated successfully"
      errorMessage="Failed to update recording"
      submitLabel="Save Changes"
      loadingLabel="Saving..."
      onSuccess={handleSuccess}
      onError={(error: Error) => {
        toast.error(error.message || 'Failed to update recording');
      }}
      onCleanup={handleCleanup}
      className="sm:max-w-[500px]"
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Title <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter recording title"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter recording description (optional)"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <TagInput
              recordingId={recording.id}
              tags={tags}
              onTagsChange={handleTagsChange}
            />
          </div>
        </>
      )}
    </FormDialog>
  );
}

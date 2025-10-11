'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import TagInput from './TagInput';
import type { Tag } from '@/lib/types/database';

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
  const [title, setTitle] = React.useState(recording.title || '');
  const [description, setDescription] = React.useState(recording.description || '');
  const [tags, setTags] = React.useState<Tag[]>(initialTags);
  const [isSaving, setIsSaving] = React.useState(false);

  // Update form when recording changes
  React.useEffect(() => {
    setTitle(recording.title || '');
    setDescription(recording.description || '');
    setTags(initialTags);
  }, [recording, initialTags]);

  const handleTagsChange = (newTags: Tag[]) => {
    setTags(newTags);
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update recording');
      }

      toast.success('Recording updated successfully');
      onOpenChange(false);

      // Notify parent
      if (onRecordingUpdated) {
        onRecordingUpdated();
      } else {
        // Refresh page if no callback provided
        window.location.reload();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update recording');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(recording.title || '');
    setDescription(recording.description || '');
    setTags(initialTags);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Recording</DialogTitle>
          <DialogDescription>
            Update the title and description for this recording.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="Enter recording title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={!title.trim()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter recording description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <TagInput
              recordingId={recording.id}
              tags={tags}
              onTagsChange={handleTagsChange}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

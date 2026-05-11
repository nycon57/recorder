'use client';

import Image from 'next/image';
import {
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, AlertCircle, ImageIcon } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { TagInput } from '@/app/components/tags/TagInput';
import ProcessingOptions from '@/app/components/upload/ProcessingOptions';
import type { AnalysisType } from '@/lib/services/analysis-templates';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface MetadataCollectionStepProps {
  defaultTitle: string;
  defaultThumbnail?: string;
  onNext: (data: {
    title: string;
    description?: string;
    tags: string[]; // Tag names
    thumbnail?: string; // Base64 data URL
    thumbnailFile?: File; // Custom thumbnail file
    analysisType?: AnalysisType; // Type of AI analysis to perform
    skipAnalysis?: boolean; // Whether to skip AI analysis
  }) => void;
  onBack: () => void;
}

/**
 * Form validation schema
 */
const metadataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().max(5000, 'Description is too long').optional(),
  tags: z
    .array(z.object({ id: z.string(), name: z.string(), color: z.string() }))
    .max(20, 'Maximum 20 tags allowed'),
});

type MetadataFormData = z.infer<typeof metadataSchema>;

/**
 * Step 2: Metadata Collection
 *
 * Features:
 * - Title input (pre-filled with filename)
 * - Description textarea
 * - Tag selection and creation
 * - Thumbnail preview and override
 * - Form validation with React Hook Form + Zod
 */
export default function MetadataCollectionStep(
  props: Parameters<typeof useMetadataCollectionStepImplementation>[0],
) {
  return useMetadataCollectionStepImplementation(props);
}

function useMetadataCollectionStepImplementation({
  defaultTitle,
  defaultThumbnail,
  onNext,
  onBack,
}: MetadataCollectionStepProps) {
  const [state, dispatch] = useReducer(
    (
      current: {
        thumbnailOverride?: string;
        thumbnailFile?: File;
        availableTags: Tag[];
        error: string | null;
        analysisType: AnalysisType;
        skipAnalysis: boolean;
      },
      patch: Partial<{
        thumbnailOverride?: string;
        thumbnailFile?: File;
        availableTags: Tag[];
        error: string | null;
        analysisType: AnalysisType;
        skipAnalysis: boolean;
      }>,
    ) => ({ ...current, ...patch }),
    {
      thumbnailOverride: undefined,
      thumbnailFile: undefined,
      availableTags: [],
      error: null,
      analysisType: 'general' as AnalysisType,
      skipAnalysis: false,
    },
  );
  const {
    thumbnailOverride,
    thumbnailFile,
    availableTags,
    error,
    analysisType,
    skipAnalysis,
  } = state;
  const thumbnail = thumbnailOverride ?? defaultThumbnail;
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<MetadataFormData>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      title: defaultTitle,
      description: '',
      tags: [],
    },
  });

  /**
   * Load available tags from API
   */
  const loadTags = useCallback(async (search: string = '') => {
    try {
      const params = new URLSearchParams();
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/tags?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();
      // API returns { data: { tags: [...], pagination: {...} } }
      const tags = data.data?.tags || [];

      dispatch({ availableTags: tags });
      return tags;
    } catch (err) {
      console.error('[MetadataCollectionStep] Failed to load tags:', err);
      return [];
    }
  }, []);

  /**
   * Load tags on mount
   */
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  /**
   * Create new tag via API
   */
  const handleCreateTag = useCallback(
    async (name: string, color: string): Promise<Tag | null> => {
      try {
        const response = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, color }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.message || 'Failed to create tag';
          console.error(
            '[MetadataCollectionStep] Tag creation failed:',
            errorMessage,
          );
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const newTag = data.data;

        // Add to available tags
        dispatch({ availableTags: [...availableTags, newTag] });

        return newTag;
      } catch (err) {
        console.error('[MetadataCollectionStep] Failed to create tag:', err);
        // Re-throw with the actual error message for better UX
        throw err;
      }
    },
    [availableTags],
  );

  /**
   * Handle thumbnail file selection
   */
  const handleThumbnailChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        dispatch({ error: 'Please select a valid image file' });
        return;
      }

      // Validate file size (max 5 MB)
      if (file.size > 5 * 1024 * 1024) {
        dispatch({ error: 'Image size must be less than 5 MB' });
        return;
      }

      dispatch({ error: null });

      // Read file and create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        dispatch({ thumbnailOverride: dataUrl, thumbnailFile: file });
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    (data: MetadataFormData) => {
      console.log('[MetadataCollectionStep] Form submitted', {
        title: data.title,
        tagCount: data.tags.length,
        hasThumbnail: !!thumbnail,
        hasCustomThumbnail: !!thumbnailFile,
        analysisType,
        skipAnalysis,
      });

      onNext({
        title: data.title,
        description: data.description,
        tags: data.tags.map((t) => t.name),
        thumbnail: thumbnailFile ? undefined : thumbnail, // Use default if no custom upload
        thumbnailFile,
        analysisType,
        skipAnalysis,
      });
    },
    [thumbnail, thumbnailFile, analysisType, skipAnalysis, onNext],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Add Details</h2>
        <p className="text-sm text-muted-foreground">
          Provide additional information to help organize and find this content
          later.
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Title Field */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter a title…"
                    className="w-full"
                  />
                </FormControl>
                <FormDescription>
                  A descriptive title for this content
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Add a description (optional)…"
                    rows={4}
                    className="w-full resize-none"
                  />
                </FormControl>
                <FormDescription>
                  Optional description to provide context
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tags Field */}
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <TagInput
                    value={field.value}
                    onChange={field.onChange}
                    availableTags={availableTags}
                    onLoadTags={loadTags}
                    onCreateTag={handleCreateTag}
                    placeholder="Add tags…"
                    maxTags={20}
                    allowCreate={true}
                    className="w-full"
                  />
                </FormControl>
                <FormDescription>
                  Select existing tags or create new ones to categorize this
                  content
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Processing Options - AI Analysis Settings */}
          <ProcessingOptions
            analysisType={analysisType}
            onAnalysisTypeChange={(nextAnalysisType) =>
              dispatch({ analysisType: nextAnalysisType })
            }
            skipAnalysis={skipAnalysis}
            onSkipAnalysisChange={(nextSkipAnalysis) =>
              dispatch({ skipAnalysis: nextSkipAnalysis })
            }
          />

          {/* Thumbnail Section */}
          <div className="space-y-3">
            <Label>Thumbnail</Label>
            {thumbnail ? (
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-zinc-950 max-w-sm">
                    <Image
                      src={thumbnail}
                      alt="Thumbnail preview"
                      width={384}
                      height={216}
                      className="w-full h-auto"
                      unoptimized
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {thumbnailFile
                        ? 'Custom thumbnail uploaded'
                        : 'Auto-generated thumbnail'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => thumbnailInputRef.current?.click()}
                    >
                      <Upload className="size-4 mr-2" />
                      Change
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer bg-background hover:border-foreground/40 hover:bg-muted/30"
                onClick={() => thumbnailInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    thumbnailInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <ImageIcon className="size-12 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    Upload a thumbnail
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click to select an image (max 5 MB)
                  </p>
                </div>
              </div>
            )}
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleThumbnailChange}
            />
          </div>

          {/*
            ACCESSIBILITY: Action buttons are inside <form> for proper keyboard navigation
            - Submit button uses type="submit" for Enter key support
            - Back button uses type="button" to prevent form submission
            - Both buttons are keyboard-accessible with proper focus management
            - Meets WCAG 2.1 Success Criterion 2.1.1 (Keyboard Accessible)
          */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onBack} type="button">
              Back
            </Button>
            <Button
              type="submit"
              disabled={!form.formState.isValid || form.formState.isSubmitting}
              className="min-w-[120px]"
            >
              {form.formState.isSubmitting ? (
                <div className="flex items-center gap-x-2">
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing…</span>
                </div>
              ) : (
                'Next'
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Error Message */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <div className="flex items-start gap-x-3">
            <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

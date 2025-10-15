import { z } from 'zod';

/**
 * Tag Management Validation Schemas
 *
 * Validation schemas for tag CRUD operations and associations.
 * Tags are organization-scoped labels with colors for content categorization.
 */

// ============================================================================
// Color Validation
// ============================================================================

/**
 * Predefined color palette for tags
 * Using Tailwind color values for consistency
 */
export const TAG_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#22c55e', // green-500
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
  '#64748b', // slate-500
] as const;

/**
 * Validate hex color format
 */
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const colorSchema = z
  .string()
  .regex(hexColorRegex, 'Invalid hex color format')
  .refine(
    (color) => {
      // Allow predefined colors or any valid hex
      return hexColorRegex.test(color);
    },
    { message: 'Color must be a valid hex color code' }
  );

// ============================================================================
// Tag CRUD Schemas
// ============================================================================

/**
 * Create tag schema
 */
export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name must be less than 50 characters')
    .trim()
    .regex(/^[a-zA-Z0-9-_\s]+$/, 'Tag name can only contain letters, numbers, spaces, hyphens, and underscores'),
  color: colorSchema.optional().default('#3b82f6'), // Default to blue
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

/**
 * Update tag schema
 */
export const updateTagSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .trim()
    .regex(/^[a-zA-Z0-9-_\s]+$/, 'Tag name can only contain letters, numbers, spaces, hyphens, and underscores')
    .optional(),
  color: colorSchema.optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// ============================================================================
// Tag Assignment Schemas
// ============================================================================

/**
 * Add tags to item schema
 */
export const addTagsToItemSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1, 'At least one tag ID is required').max(20, 'Cannot add more than 20 tags at once'),
});

export type AddTagsToItemInput = z.infer<typeof addTagsToItemSchema>;

/**
 * Set tags for item schema (replaces all tags)
 */
export const setItemTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).max(50, 'Cannot assign more than 50 tags to an item'),
});

export type SetItemTagsInput = z.infer<typeof setItemTagsSchema>;

/**
 * Create tags inline schema (for creating tags while assigning)
 */
export const createTagsInlineSchema = z.object({
  tags: z.array(
    z.union([
      z.string().uuid(), // Existing tag ID
      z.object({
        name: z.string().min(1).max(50).trim(),
        color: colorSchema.optional(),
      }), // New tag to create
    ])
  ).min(1).max(20),
});

export type CreateTagsInlineInput = z.infer<typeof createTagsInlineSchema>;

// ============================================================================
// Tag Query Schemas
// ============================================================================

/**
 * List tags query schema
 */
export const listTagsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['name_asc', 'name_desc', 'created_asc', 'created_desc', 'usage_desc']).default('name_asc'),
  includeUsageCount: z.coerce.boolean().default(false),
});

export type ListTagsQueryInput = z.infer<typeof listTagsQuerySchema>;

/**
 * Filter by tags schema (for content filtering)
 */
export const filterByTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1).max(20),
  mode: z.enum(['and', 'or']).default('or'), // AND = all tags, OR = any tag
});

export type FilterByTagsInput = z.infer<typeof filterByTagsSchema>;

// ============================================================================
// Batch Operations Schemas
// ============================================================================

/**
 * Batch delete tags schema
 */
export const batchDeleteTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1).max(50),
  removeFromItems: z.boolean().default(true), // Remove tag associations
});

export type BatchDeleteTagsInput = z.infer<typeof batchDeleteTagsSchema>;

/**
 * Batch tag items schema
 */
export const batchTagItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(100),
  tagIds: z.array(z.string().uuid()).min(1).max(20),
  mode: z.enum(['add', 'replace']).default('add'), // Add to existing or replace all
});

export type BatchTagItemsInput = z.infer<typeof batchTagItemsSchema>;

// ============================================================================
// Tag Merge Schema
// ============================================================================

/**
 * Merge tags schema (combine multiple tags into one)
 */
export const mergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string().uuid()).min(2).max(10),
  targetTagId: z.string().uuid(), // Tag to merge into
  deleteSourceTags: z.boolean().default(true),
});

export type MergeTagsInput = z.infer<typeof mergeTagsSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate tag name uniqueness (case-insensitive)
 */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Check if color is from predefined palette
 */
export function isPredefinedColor(color: string): boolean {
  return TAG_COLORS.includes(color as any);
}

/**
 * Get default color for auto-generated tags
 */
export function getDefaultTagColor(index?: number): string {
  if (index !== undefined) {
    return TAG_COLORS[index % TAG_COLORS.length];
  }
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

// ============================================================================
// Export all schemas
// ============================================================================

export const tagSchemas = {
  createTag: createTagSchema,
  updateTag: updateTagSchema,
  addTagsToItem: addTagsToItemSchema,
  setItemTags: setItemTagsSchema,
  createTagsInline: createTagsInlineSchema,
  listTagsQuery: listTagsQuerySchema,
  filterByTags: filterByTagsSchema,
  batchDeleteTags: batchDeleteTagsSchema,
  batchTagItems: batchTagItemsSchema,
  mergeTags: mergeTagsSchema,
} as const;
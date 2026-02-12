/**
 * Related content suggestions based on shared concepts or vector similarity.
 * Server Component — fetches data at render time, no client-side state.
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  VideoIcon,
  FileVideoIcon,
  AudioLinesIcon,
  FileTextIcon,
  FileEditIcon,
  LinkIcon,
} from 'lucide-react';

import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { vectorSearch } from '@/lib/services/vector-search-google';
import type { ContentType } from '@/lib/types/database';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
} from '@/lib/types/content';

interface RelatedContentProps {
  contentId: string;
  orgId: string;
  limit?: number;
}

interface RelatedItem {
  id: string;
  title: string | null;
  content_type: ContentType | null;
  thumbnail_url: string | null;
  created_at: string;
  /** Number of shared concepts, or similarity score from vector search */
  relevanceScore: number;
  /** Whether score represents concept overlap count or similarity */
  scoreType: 'concepts' | 'similarity';
}

const contentTypeIcons: Record<ContentType, typeof VideoIcon> = {
  recording: VideoIcon,
  video: FileVideoIcon,
  audio: AudioLinesIcon,
  document: FileTextIcon,
  text: FileEditIcon,
};

/** Row shape returned from the `content` table query (admin client lacks Database generic). */
interface ContentRow {
  id: string;
  title: string | null;
  content_type: ContentType | null;
  thumbnail_url: string | null;
  created_at: string;
}

async function findRelatedByConceptOverlap(
  contentId: string,
  orgId: string,
  limit: number
): Promise<RelatedItem[]> {
  // Step 1: Get concept IDs for this content
  const { data: contentConcepts, error: conceptsError } = await supabaseAdmin
    .from('concept_mentions')
    .select('concept_id')
    .eq('content_id', contentId)
    .eq('org_id', orgId);

  if (conceptsError || !contentConcepts || contentConcepts.length === 0) {
    return [];
  }

  const conceptIds = [
    ...new Set(contentConcepts.map((c: { concept_id: string }) => c.concept_id)),
  ];

  // Step 2: Find other content sharing those concepts
  const { data: relatedMentions, error: mentionsError } = await supabaseAdmin
    .from('concept_mentions')
    .select('content_id')
    .in('concept_id', conceptIds)
    .eq('org_id', orgId)
    .neq('content_id', contentId);

  if (mentionsError || !relatedMentions || relatedMentions.length === 0) {
    return [];
  }

  // Count concept overlap per content
  const overlapCounts = new Map<string, number>();
  for (const mention of relatedMentions as { content_id: string }[]) {
    overlapCounts.set(mention.content_id, (overlapCounts.get(mention.content_id) || 0) + 1);
  }

  // Sort by overlap count descending, take top N
  const topContentIds = [...overlapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  // Step 3: Fetch content details
  const { data: contentItems, error: contentError } = await supabaseAdmin
    .from('content')
    .select('id, title, content_type, thumbnail_url, created_at')
    .in('id', topContentIds)
    .is('deleted_at', null)
    .eq('org_id', orgId);

  if (contentError || !contentItems) {
    return [];
  }

  // Map content items with overlap counts, preserving sort order
  const contentMap = new Map(
    (contentItems as ContentRow[]).map((item) => [item.id, item])
  );

  return topContentIds.reduce<RelatedItem[]>((acc, id) => {
    const item = contentMap.get(id);
    if (!item) return acc;
    acc.push({
      id: item.id,
      title: item.title,
      content_type: item.content_type,
      thumbnail_url: item.thumbnail_url,
      created_at: item.created_at,
      relevanceScore: overlapCounts.get(id) || 0,
      scoreType: 'concepts',
    });
    return acc;
  }, []);
}

async function findRelatedByVectorSimilarity(
  contentId: string,
  orgId: string,
  limit: number
): Promise<RelatedItem[]> {
  // Get the content's title for the search query
  const { data: content, error: contentError } = await supabaseAdmin
    .from('content')
    .select('title')
    .eq('id', contentId)
    .eq('org_id', orgId)
    .single();

  if (contentError || !content?.title) {
    return [];
  }

  try {
    const results = await vectorSearch(content.title, {
      orgId,
      limit: limit + 5, // Fetch extra to account for self-match filtering
      threshold: 0.5,
    });

    // Deduplicate by contentId and exclude the current content
    const seen = new Set<string>();
    seen.add(contentId);
    const items: RelatedItem[] = [];

    for (const result of results) {
      if (seen.has(result.contentId) || items.length >= limit) continue;
      seen.add(result.contentId);
      items.push({
        id: result.contentId,
        title: result.contentTitle,
        content_type: (result.contentType as ContentType) || null,
        thumbnail_url: null, // Vector search doesn't return thumbnails
        created_at: result.createdAt,
        relevanceScore: result.similarity ?? 0,
        scoreType: 'similarity',
      });
    }

    return items;
  } catch (error) {
    console.error('[RelatedContent] Vector search failed:', error);
    return [];
  }
}

export async function RelatedContent({
  contentId,
  orgId,
  limit = 5,
}: RelatedContentProps) {
  // Try concept-based matching first
  let items = await findRelatedByConceptOverlap(contentId, orgId, limit);

  // Fall back to vector similarity if no concept matches
  if (items.length === 0) {
    items = await findRelatedByVectorSimilarity(contentId, orgId, limit);
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No related content found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const contentType = item.content_type || 'recording';
        const Icon = contentTypeIcons[contentType];
        const colors = CONTENT_TYPE_COLORS[contentType];
        const label = CONTENT_TYPE_LABELS[contentType];

        return (
          <Link
            key={item.id}
            href={`/library/${item.id}`}
            className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl"
            aria-label={`View ${item.title || 'Untitled'}`}
          >
            <Card className="card-interactive overflow-hidden py-0">
              <div className="flex items-center gap-3 p-3">
                {/* Thumbnail or icon */}
                <div
                  className={`relative shrink-0 size-12 rounded-lg ${colors.bg} flex items-center justify-center overflow-hidden`}
                >
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Icon className={`size-5 ${colors.text}`} />
                  )}
                </div>

                {/* Content details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium line-clamp-1">
                    {item.title || 'Untitled'}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {label}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <LinkIcon className="size-3" />
                      {item.scoreType === 'concepts'
                        ? `${item.relevanceScore} shared concept${item.relevanceScore !== 1 ? 's' : ''}`
                        : `${Math.round(item.relevanceScore * 100)}% similar`}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

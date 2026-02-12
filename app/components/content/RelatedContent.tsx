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
  relevanceScore: number;
  scoreType: 'concepts' | 'similarity';
}

const CONTENT_TYPE_ICONS: Record<ContentType, typeof VideoIcon> = {
  recording: VideoIcon,
  video: FileVideoIcon,
  audio: AudioLinesIcon,
  document: FileTextIcon,
  text: FileEditIcon,
};

function isValidContentType(type: string): type is ContentType {
  return type in CONTENT_TYPE_ICONS;
}

async function findRelatedByConceptOverlap(
  contentId: string,
  orgId: string,
  limit: number
): Promise<RelatedItem[]> {
  const { data: contentConcepts, error: conceptsError } = await supabaseAdmin
    .from('concept_mentions')
    .select('concept_id')
    .eq('content_id', contentId)
    .eq('org_id', orgId);

  if (conceptsError) {
    console.error('[RelatedContent] Failed to fetch concept mentions:', conceptsError);
    return [];
  }

  if (!contentConcepts?.length) return [];

  const conceptIds = [...new Set(contentConcepts.map((c) => c.concept_id))];

  const { data: relatedMentions, error: mentionsError } = await supabaseAdmin
    .from('concept_mentions')
    .select('content_id')
    .in('concept_id', conceptIds)
    .eq('org_id', orgId)
    .neq('content_id', contentId)
    .limit(limit * 50);

  if (mentionsError) {
    console.error('[RelatedContent] Failed to fetch related mentions:', mentionsError);
    return [];
  }

  if (!relatedMentions?.length) return [];

  // Count concept overlap per content
  const overlapCounts = new Map<string, number>();
  for (const mention of relatedMentions) {
    const id = (mention as { content_id: string }).content_id;
    overlapCounts.set(id, (overlapCounts.get(id) ?? 0) + 1);
  }

  // Sort by overlap count descending, take top N
  const topContentIds = [...overlapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const { data: contentItems, error: contentError } = await supabaseAdmin
    .from('content')
    .select('id, title, content_type, thumbnail_url, created_at')
    .in('id', topContentIds)
    .is('deleted_at', null)
    .eq('org_id', orgId);

  if (contentError) {
    console.error('[RelatedContent] Failed to fetch content details:', contentError);
    return [];
  }

  if (!contentItems) return [];

  // Preserve sort order from overlapCounts ranking
  const contentById = new Map(
    contentItems.map((item) => [item.id, item])
  );

  return topContentIds.flatMap((id) => {
    const item = contentById.get(id);
    if (!item) return [];
    return {
      id: item.id,
      title: item.title,
      content_type: item.content_type as ContentType | null,
      thumbnail_url: item.thumbnail_url,
      created_at: item.created_at,
      relevanceScore: overlapCounts.get(id) ?? 0,
      scoreType: 'concepts' as const,
    };
  });
}

async function findRelatedByVectorSimilarity(
  contentId: string,
  orgId: string,
  limit: number
): Promise<RelatedItem[]> {
  const { data: content, error: contentError } = await supabaseAdmin
    .from('content')
    .select('title')
    .eq('id', contentId)
    .eq('org_id', orgId)
    .single();

  if (contentError || !content?.title) {
    if (contentError) {
      console.error('[RelatedContent] Failed to fetch content for vector search:', contentError);
    }
    return [];
  }

  try {
    const results = await vectorSearch(content.title, {
      orgId,
      limit: limit + 5, // Fetch extra to account for self-match filtering
      threshold: 0.5,
    });

    const seen = new Set<string>([contentId]);
    const items: RelatedItem[] = [];

    for (const result of results) {
      if (seen.has(result.contentId) || items.length >= limit) continue;
      seen.add(result.contentId);
      items.push({
        id: result.contentId,
        title: result.contentTitle,
        content_type: isValidContentType(result.contentType) ? result.contentType : null,
        thumbnail_url: null,
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
  // Concept-based first, fall back to vector similarity
  let items = await findRelatedByConceptOverlap(contentId, orgId, limit);

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
        const contentType = item.content_type ?? 'recording';
        const Icon = CONTENT_TYPE_ICONS[contentType];
        const colors = CONTENT_TYPE_COLORS[contentType];
        const label = CONTENT_TYPE_LABELS[contentType];

        return (
          <Link
            key={item.id}
            href={`/library/${item.id}`}
            className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl"
            aria-label={`View ${item.title ?? 'Untitled'}`}
          >
            <Card className="card-interactive overflow-hidden py-0">
              <div className="flex items-center gap-3 p-3">
                <div
                  className={`relative shrink-0 size-12 rounded-lg ${colors.bg} flex items-center justify-center overflow-hidden`}
                >
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Icon className={`size-5 ${colors.text}`} aria-hidden="true" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium line-clamp-1">
                    {item.title ?? 'Untitled'}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {label}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <LinkIcon className="size-3" aria-hidden="true" />
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

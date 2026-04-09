import { createClient } from '@/lib/supabase/server';

/**
 * Features used for ranking ML model
 */
interface RankingFeatures {
  // Relevance features
  semanticSimilarity: number; // 0-1
  keywordMatches: number;
  titleMatch: boolean;

  // User behavior features
  historicalClickRate: number; // 0-1
  averageDwellTime: number; // seconds
  thumbsUpRate: number; // 0-1
  bookmarkRate: number; // 0-1

  // Recency features
  daysSinceCreated: number;
  daysSinceModified: number;

  // Content features
  contentLength: number;
  hasTranscript: boolean;
  hasDocument: boolean;
  hasVideo: boolean;
}

interface SearchResult {
  id: string;
  title?: string;
  content: string;
  type: string;
  similarity?: number;
  createdAt: string;
}

interface FeedbackStats {
  clickRate: number;
  avgDwellTime: number;
  thumbsUpRate: number;
  bookmarkRate: number;
}

/**
 * ML-based ranking system using user feedback
 */
export class RankingML {
  /**
   * Re-rank search results based on ML model
   */
  static async rerank(
    results: SearchResult[],
    query: string,
    orgId: string
  ): Promise<SearchResult[]> {
    // Get historical feedback for these results
    const feedback = await this.getHistoricalFeedback(
      results.map((r) => r.id),
      orgId
    );

    // Compute features and scores for each result
    const scored = results.map((result) => {
      const features = this.extractFeatures(result, query, feedback);
      const score = this.computeScore(features);

      return {
        result,
        score,
        features,
      };
    });

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Return re-ranked results
    return scored.map((item) => item.result);
  }

  /**
   * Extract features for a result
   */
  private static extractFeatures(
    result: SearchResult,
    query: string,
    feedback: Map<string, FeedbackStats>
  ): RankingFeatures {
    const stats = feedback.get(result.id) || {
      clickRate: 0,
      avgDwellTime: 0,
      thumbsUpRate: 0,
      bookmarkRate: 0,
    };

    const now = new Date();
    const createdAt = new Date(result.createdAt);
    const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    return {
      // Relevance (from vector search similarity)
      semanticSimilarity: result.similarity || 0,
      keywordMatches: this.countKeywordMatches(query, result.content),
      titleMatch: result.title?.toLowerCase().includes(query.toLowerCase()) || false,

      // User behavior
      historicalClickRate: stats.clickRate,
      averageDwellTime: stats.avgDwellTime,
      thumbsUpRate: stats.thumbsUpRate,
      bookmarkRate: stats.bookmarkRate,

      // Recency
      daysSinceCreated,
      daysSinceModified: daysSinceCreated, // TODO: track modification date

      // Content
      contentLength: result.content.length,
      hasTranscript: result.type === 'transcript',
      hasDocument: result.type === 'document',
      hasVideo: result.type === 'recording',
    };
  }

  /**
   * Compute final score from features
   * (Simple linear model - could be replaced with XGBoost, neural network, etc.)
   */
  private static computeScore(features: RankingFeatures): number {
    // Weights learned from user feedback (these are example values)
    const weights = {
      semanticSimilarity: 0.35,
      keywordMatches: 0.05,
      titleMatch: 0.10,
      historicalClickRate: 0.20,
      averageDwellTime: 0.10,
      thumbsUpRate: 0.10,
      bookmarkRate: 0.05,
      recencyBoost: 0.05,
    };

    let score = 0;

    // Relevance signals
    score += features.semanticSimilarity * weights.semanticSimilarity;
    score += Math.min(features.keywordMatches / 5, 1) * weights.keywordMatches;
    score += (features.titleMatch ? 1 : 0) * weights.titleMatch;

    // User behavior signals
    score += features.historicalClickRate * weights.historicalClickRate;
    score += Math.min(features.averageDwellTime / 60, 1) * weights.averageDwellTime;
    score += features.thumbsUpRate * weights.thumbsUpRate;
    score += features.bookmarkRate * weights.bookmarkRate;

    // Recency boost (exponential decay)
    const recencyScore = Math.exp(-features.daysSinceCreated / 30); // 30-day half-life
    score += recencyScore * weights.recencyBoost;

    return score;
  }

  /**
   * Get historical feedback stats for results
   */
  private static async getHistoricalFeedback(
    resultIds: string[],
    orgId: string
  ): Promise<Map<string, FeedbackStats>> {
    const supabase = await createClient();

    const { data: feedback } = await supabase
      .from('search_feedback')
      .select('*')
      .eq('org_id', orgId)
      .in('result_id', resultIds);

    const stats = new Map<string, FeedbackStats>();

    if (!feedback || feedback.length === 0) {
      return stats;
    }

    // Aggregate feedback by result
    for (const resultId of resultIds) {
      const resultFeedback = feedback.filter((f) => f.result_id === resultId);

      if (resultFeedback.length === 0) {
        continue;
      }

      const totalFeedback = resultFeedback.length;
      const clicks = resultFeedback.filter((f) => f.feedback_type === 'click').length;
      const thumbsUp = resultFeedback.filter((f) => f.feedback_type === 'thumbs_up').length;
      const bookmarks = resultFeedback.filter((f) => f.feedback_type === 'bookmark').length;

      const dwellTimes = resultFeedback
        .filter((f) => f.dwell_time_ms)
        .map((f) => f.dwell_time_ms / 1000); // convert to seconds

      stats.set(resultId, {
        clickRate: clicks / totalFeedback,
        avgDwellTime: dwellTimes.length > 0
          ? dwellTimes.reduce((sum, t) => sum + t, 0) / dwellTimes.length
          : 0,
        thumbsUpRate: thumbsUp / totalFeedback,
        bookmarkRate: bookmarks / totalFeedback,
      });
    }

    return stats;
  }

  /**
   * Count keyword matches in content
   */
  private static countKeywordMatches(query: string, content: string): number {
    const keywords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    return keywords.filter((keyword) => contentLower.includes(keyword)).length;
  }
}

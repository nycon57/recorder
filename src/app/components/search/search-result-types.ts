export interface SearchResultItem {
  id: string;
  contentId: string;
  contentTitle: string;
  contentType: string;
  chunkText: string;
  similarity: number;
  metadata: {
    source?: 'transcript' | 'document';
    transcriptId?: string;
    documentId?: string;
    chunkIndex?: number;
    startTime?: number;
    endTime?: number;
    startChar?: number;
    endChar?: number;
    timestampRange?: string;
    isFavorite?: boolean;
  };
}

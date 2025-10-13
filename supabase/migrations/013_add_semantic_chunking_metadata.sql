-- Migration: Add semantic chunking metadata to transcript_chunks
-- Description: Adds columns to support semantic chunking strategy, structure detection, and quality metrics
-- Phase: 2 - Semantic Chunking

-- Add semantic chunking metadata columns
ALTER TABLE transcript_chunks
ADD COLUMN IF NOT EXISTS chunking_strategy TEXT DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS semantic_score FLOAT,
ADD COLUMN IF NOT EXISTS structure_type TEXT,
ADD COLUMN IF NOT EXISTS boundary_type TEXT;

-- Create indexes for analytics and querying
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_strategy
  ON transcript_chunks(chunking_strategy);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_structure
  ON transcript_chunks(structure_type);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_semantic_score
  ON transcript_chunks(semantic_score DESC NULLS LAST)
  WHERE semantic_score IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN transcript_chunks.chunking_strategy IS
  'Chunking method used: fixed, semantic, adaptive, hybrid';

COMMENT ON COLUMN transcript_chunks.semantic_score IS
  'Internal coherence score (0-1) measuring chunk semantic cohesion. Higher scores indicate better semantic boundaries.';

COMMENT ON COLUMN transcript_chunks.structure_type IS
  'Content structure type: code, list, table, paragraph, heading, mixed';

COMMENT ON COLUMN transcript_chunks.boundary_type IS
  'Boundary decision rationale: semantic_break, size_limit, structure_boundary, topic_shift';

-- Update existing chunks to have default strategy
UPDATE transcript_chunks
SET chunking_strategy = 'fixed'
WHERE chunking_strategy IS NULL;

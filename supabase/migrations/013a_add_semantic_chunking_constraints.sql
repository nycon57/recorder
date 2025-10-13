-- Migration: Add validation constraints for semantic chunking metadata
-- Description: Enforces data integrity for chunking_strategy, semantic_score, structure_type, boundary_type
-- Phase: 2a - Semantic Chunking Constraints
-- Prerequisites: 013_add_semantic_chunking_metadata.sql must be applied first

-- =============================================================================
-- DATA VALIDATION CONSTRAINTS
-- =============================================================================

-- Constraint: chunking_strategy must be a valid enum value
ALTER TABLE transcript_chunks
  ADD CONSTRAINT check_chunking_strategy
  CHECK (chunking_strategy IN ('fixed', 'semantic', 'adaptive', 'hybrid'));

COMMENT ON CONSTRAINT check_chunking_strategy ON transcript_chunks IS
  'Ensures only valid chunking strategies are stored: fixed, semantic, adaptive, hybrid';

-- Constraint: semantic_score must be between 0 and 1 (or NULL)
ALTER TABLE transcript_chunks
  ADD CONSTRAINT check_semantic_score_range
  CHECK (semantic_score IS NULL OR (semantic_score >= 0 AND semantic_score <= 1));

COMMENT ON CONSTRAINT check_semantic_score_range ON transcript_chunks IS
  'Semantic score represents coherence (0-1 scale), NULL allowed for non-semantic chunks';

-- Constraint: structure_type must be a valid content structure
ALTER TABLE transcript_chunks
  ADD CONSTRAINT check_structure_type
  CHECK (
    structure_type IS NULL OR
    structure_type IN ('paragraph', 'code', 'list', 'table', 'heading', 'mixed')
  );

COMMENT ON CONSTRAINT check_structure_type ON transcript_chunks IS
  'Defines detected content structure type, NULL allowed if not analyzed';

-- Constraint: boundary_type must be a valid boundary decision
ALTER TABLE transcript_chunks
  ADD CONSTRAINT check_boundary_type
  CHECK (
    boundary_type IS NULL OR
    boundary_type IN ('semantic_break', 'size_limit', 'structure_boundary', 'topic_shift')
  );

COMMENT ON CONSTRAINT check_boundary_type ON transcript_chunks IS
  'Defines why chunk boundary was created, NULL allowed for fixed chunks';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  -- Count constraints added
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint
  WHERE conrelid = 'transcript_chunks'::regclass
    AND conname LIKE 'check_%chunking%' OR conname LIKE 'check_%semantic%';

  IF constraint_count < 4 THEN
    RAISE EXCEPTION 'Expected 4 constraints, found %', constraint_count;
  END IF;

  RAISE NOTICE 'Successfully added % data validation constraints to transcript_chunks', constraint_count;
END $$;

-- Test constraints (should pass with existing data)
DO $$
BEGIN
  -- Test 1: Verify no invalid chunking_strategy values
  IF EXISTS (
    SELECT 1 FROM transcript_chunks
    WHERE chunking_strategy NOT IN ('fixed', 'semantic', 'adaptive', 'hybrid')
  ) THEN
    RAISE EXCEPTION 'Found invalid chunking_strategy values - data cleanup required';
  END IF;

  -- Test 2: Verify no out-of-range semantic_score values
  IF EXISTS (
    SELECT 1 FROM transcript_chunks
    WHERE semantic_score IS NOT NULL
      AND (semantic_score < 0 OR semantic_score > 1)
  ) THEN
    RAISE EXCEPTION 'Found out-of-range semantic_score values - data cleanup required';
  END IF;

  -- Test 3: Verify no invalid structure_type values
  IF EXISTS (
    SELECT 1 FROM transcript_chunks
    WHERE structure_type IS NOT NULL
      AND structure_type NOT IN ('paragraph', 'code', 'list', 'table', 'heading', 'mixed')
  ) THEN
    RAISE EXCEPTION 'Found invalid structure_type values - data cleanup required';
  END IF;

  -- Test 4: Verify no invalid boundary_type values
  IF EXISTS (
    SELECT 1 FROM transcript_chunks
    WHERE boundary_type IS NOT NULL
      AND boundary_type NOT IN ('semantic_break', 'size_limit', 'structure_boundary', 'topic_shift')
  ) THEN
    RAISE EXCEPTION 'Found invalid boundary_type values - data cleanup required';
  END IF;

  RAISE NOTICE 'All constraint validation tests passed';
END $$;

# AI Insights System - Content-Type-Aware Document Generation

## Overview

The AI Insights system generates intelligent, actionable insights from all content types (recordings, documents, notes, etc.) using content-type-specific prompts that focus on **analysis and implications** rather than simple reformatting.

## Problem Statement

**Previous System (v1):**
- Used generic "convert transcript to markdown" prompt for all content
- Resulted in reformatted content without actual insights
- Example: Q4 Rocks document → Same content with different headings (not helpful)
- No differentiation between meeting notes, tutorials, strategic docs, etc.

**User Feedback:**
> "It is not helpful information and is more of a regurgitation of the same thing in the document. Not a true analysis."

## Solution Design (v2)

### Architecture

```
Content Upload
    ↓
Text Extraction (DOCX, PDF, audio transcription, etc.)
    ↓
Content Type Detection (LLM classification)
    ↓
Content-Type-Specific Prompt Selection
    ↓
AI Insights Generation (analysis-focused)
    ↓
Document Storage (with metadata: content_type, generation_method)
    ↓
Vector Embeddings & Search
```

### Content Types Supported

1. **Strategic Planning** - OKRs, quarterly rocks, roadmaps, project plans
   - Focus: Risk analysis, dependencies, resource assessment, timeline evaluation
   - Example output: "Rock 2 has a critical dependency on Rock 1 that isn't called out..."

2. **Meeting** - Meeting notes, discussions, team syncs
   - Focus: Decisions made, action items, blockers, disagreements
   - Example output: "Three key decisions emerged, but ownership for Action Item #4 is unclear..."

3. **Tutorial** - How-to guides, technical walkthroughs, demos
   - Focus: Core concepts, common pitfalls, best practices, learning path
   - Example output: "The tutorial assumes knowledge of X, which could block beginners..."

4. **Documentation** - Technical docs, API references, user guides
   - Focus: Quality assessment, completeness, gaps, improvement recommendations
   - Example output: "The error handling section lacks concrete examples..."

5. **Training** - Educational content, courses, skill development
   - Focus: Learning objectives, skill application, knowledge checks
   - Example output: "Learners should be able to apply X in scenarios Y and Z..."

6. **Conversation** - Interviews, discussions, Q&A sessions
   - Focus: Themes, perspectives, key quotes, insights
   - Example output: "Three distinct viewpoints emerged around topic X..."

7. **General** - Fallback for content that doesn't fit other categories
   - Focus: Context, deeper analysis, implications, recommendations

### Prompt Structure

All prompts follow this structure:

```markdown
## Executive Summary (2-3 sentences)
- What is this content about?
- Why does it matter?

## Key Insights (3-7 bullet points)
- Extract insights NOT explicitly stated
- Answer "so what?" for major points
- Identify patterns, implications, risks, opportunities

## Main Content (organized with clear headings)
- Logical organization
- Clear hierarchy
- Preserved critical details

## Actionable Takeaways (3-5 bullet points)
- Specific next steps
- What should someone DO with this information?

## Questions & Considerations (2-4 bullet points)
- What questions does this raise?
- What's unclear or needs more information?
- What assumptions should be validated?

## [Content-Type-Specific Sections]
- Additional analysis based on content type
- Strategic Planning: Risk Analysis, Timeline Assessment, etc.
- Meeting: Decisions Made, Action Items, etc.
- Tutorial: Core Concepts, Common Pitfalls, etc.
```

### Content Type Detection

Uses LLM classification with low temperature (0.1) for consistency:

```typescript
const contentType = await detectContentType(transcript.text, model);
// Returns: 'strategic_planning' | 'meeting' | 'tutorial' | etc.
```

Classification analyzes the first 2000 characters and categorizes based on:
- Language patterns (e.g., "OKR", "Rock", "deliverable" → strategic_planning)
- Structure (e.g., step-by-step → tutorial)
- Purpose (e.g., action items, decisions → meeting)

## Implementation

### File Structure

```
lib/prompts/
  ├── insights-prompts.ts    # Content-type-specific prompts
  └── README.md              # This file

lib/workers/handlers/
  └── docify-google.ts       # Document generation handler (updated)

lib/google/
  └── client.ts              # Google AI client (legacy prompts)
```

### Usage in Document Generation

```typescript
// 1. Detect content type
const contentType = await detectContentType(transcript.text, model);

// 2. Get content-type-specific prompt
const basePrompt = getInsightsPrompt(contentType);

// 3. Build full prompt with context
let enhancedPrompt = `${basePrompt}\n\n${contextInfo}\n\n`;

// 4. Add screen recording enhancement if applicable
if (hasVisualContext) {
  enhancedPrompt += `${SCREEN_RECORDING_ENHANCEMENT}\n\n`;
}

// 5. Generate insights
const result = await model.generateContent(enhancedPrompt);
```

### Document Metadata

Documents generated with v2 insights include metadata:

```json
{
  "version": "v2",
  "metadata": {
    "content_type": "strategic_planning",
    "has_visual_context": false,
    "generation_method": "insights"
  }
}
```

This allows:
- Tracking which content types are being processed
- A/B testing v1 vs v2 outputs
- Filtering/sorting documents by content type in UI
- Analytics on which content types perform best

## Examples

### Before (v1) - Reformatting

**Input:** Q4 Rocks document with objectives, deliverables, success metrics

**Output:**
```markdown
# Q4 Marketing Rocks

## Rock 1: Build internal communications cadence & governance
- What: Launch a standardized Internal Communications Calendar
- How / Deliverables: ...
- Measure of Success: ...

[Essentially the same content with different formatting]
```

**Problem:** No actual insights, just reformatted the source material.

### After (v2) - Insights & Analysis

**Input:** Same Q4 Rocks document

**Output:**
```markdown
## Executive Summary
This document outlines three ambitious Q4 initiatives...

## Key Insights
- **Critical Dependency:** Rock 2 (Affinity) relies on Rock 1 (Internal Comms)
  for successful rollout, but this dependency isn't explicitly called out.
  The Affinity training materials need the communication calendar to be live first.

- **Resource Constraint:** All three rocks require significant time from the
  marketing team, but no resource allocation or capacity planning is mentioned.
  Risk of overcommitment.

- **Success Metrics Need Leading Indicators:** All success metrics are lagging
  indicators (e.g., "calendar live", "store launched"). No early warning signals
  to detect if you're off track mid-quarter.

## Risk Analysis
1. **High Risk - Rock 3:** "Role-based automation" is vague. Without clear scope...
2. **Medium Risk - Rock 2:** Onboarding "at least 1 employer" is a low bar...
3. **Timeline Risk:** No dates or milestones means no way to track progress...

[And so on with actual analysis and recommendations]
```

**Result:** Actionable insights that help the team execute better.

## Configuration

### Environment Variables

No new environment variables required - uses existing Google AI setup.

### Feature Flags

None currently, but could add:

```bash
# Enable/disable insights v2
ENABLE_INSIGHTS_V2=true

# Force specific content type (for testing)
FORCE_CONTENT_TYPE=strategic_planning
```

## Monitoring & Analytics

### Logging

All document generation includes content type in logs:

```
[Docify] Content type detected: strategic_planning
[Docify] Document generation completed: contentType=strategic_planning, totalTime=12.3s
```

### Database Queries

Query documents by content type:

```sql
-- Count documents by content type
SELECT
  metadata->>'content_type' as content_type,
  COUNT(*) as count
FROM documents
WHERE version = 'v2'
GROUP BY metadata->>'content_type'
ORDER BY count DESC;

-- Find all strategic planning documents
SELECT *
FROM documents
WHERE version = 'v2'
AND metadata->>'content_type' = 'strategic_planning';
```

### A/B Testing

Compare v1 vs v2 outputs:

```sql
-- Average processing time by version
SELECT
  version,
  AVG((metadata->>'total_time')::int) as avg_time_ms
FROM documents
GROUP BY version;
```

## Testing

### Unit Tests

Test content type detection:

```typescript
// Test strategic planning detection
const content = "Q4 Rocks: Build internal communications...";
const type = await detectContentType(content, model);
expect(type).toBe('strategic_planning');

// Test meeting detection
const meetingContent = "Action items: John to follow up...";
const meetingType = await detectContentType(meetingContent, model);
expect(meetingType).toBe('meeting');
```

### Integration Tests

1. Upload Q4 Rocks DOCX
2. Verify content type = 'strategic_planning'
3. Verify insights include Risk Analysis section
4. Verify insights include actual analysis (not just reformatted content)

## Performance

### Content Type Detection

- **Time:** ~1-2 seconds (low-temperature LLM call)
- **Tokens:** ~50 tokens output, ~500 tokens input (first 2000 chars)
- **Cost:** Negligible (< $0.001 per detection)

### Document Generation

- **Time:** ~10-30 seconds (same as v1, depends on content length)
- **Quality:** Significantly improved insights
- **Tokens:** Similar to v1 (prompts are longer but more focused)

## Future Improvements

### Short-term
1. **Fine-tuned Classification:** Train custom classifier for faster/cheaper content type detection
2. **User Feedback Loop:** Allow users to rate insights quality and correct content type
3. **Custom Prompts:** Allow organizations to customize prompts for their domain
4. **Multi-language:** Support non-English content type detection

### Long-term
1. **Domain-Specific Types:** Add industry-specific content types (e.g., "clinical_notes", "legal_brief")
2. **Hierarchical Classification:** Detect subtypes (e.g., "tutorial.beginner" vs "tutorial.advanced")
3. **Context-Aware Prompts:** Use org history and preferences to customize prompts
4. **Automated Prompt Optimization:** A/B test prompt variations and optimize for quality

## Migration Guide

### Upgrading from v1

No database migration required. New documents automatically use v2.

**To regenerate existing documents with v2:**

```typescript
// Find v1 documents
const { data: v1Docs } = await supabase
  .from('documents')
  .select('id, recording_id')
  .eq('version', 'v1');

// Enqueue regeneration jobs
for (const doc of v1Docs) {
  await createJob({
    type: 'doc_regenerate',
    payload: { documentId: doc.id, recordingId: doc.recording_id },
    dedupe_key: `doc_regenerate:${doc.id}`,
  });
}
```

### Rollback to v1

To revert to v1 prompts:

1. Comment out imports in `docify-google.ts`
2. Replace prompt construction with:
   ```typescript
   const enhancedPrompt = `${PROMPTS.DOCIFY}\n\n${contextInfo}\n\nTranscript:\n${transcript.text}`;
   ```
3. Remove metadata updates

## Support

### Troubleshooting

**Issue:** Content type detection returns "general" for everything
- **Cause:** Classification model may need tuning
- **Fix:** Review CONTENT_TYPE_DETECTION_PROMPT, add more examples

**Issue:** Insights still feel like reformatting
- **Cause:** Prompt may need more explicit instructions
- **Fix:** Review content-type-specific prompt, add more emphasis on analysis vs reformatting

**Issue:** Processing takes too long
- **Cause:** Content type detection adds overhead
- **Fix:** Cache content type for similar documents, or skip detection for obvious types

### Logs to Check

```bash
# View content type distribution
grep "Content type detected" worker.log | awk '{print $NF}' | sort | uniq -c

# View generation times
grep "Document generation completed" worker.log | grep -o "totalTime=[0-9]*"

# Check for errors
grep "ERROR.*docify" worker.log
```

## Contributing

### Adding a New Content Type

1. Define the type in `insights-prompts.ts`:
   ```typescript
   export type ContentType =
     | 'existing_types'
     | 'my_new_type';
   ```

2. Add classification logic in `CONTENT_TYPE_DETECTION_PROMPT`

3. Create prompt in `INSIGHTS_PROMPTS`:
   ```typescript
   my_new_type: `You are a [role]. Your job is to...

   ${BASE_STRUCTURE}

   ## [Type]-Specific Sections
   ...`,
   ```

4. Test with sample content
5. Update this README with examples

### Improving Existing Prompts

1. Test current prompt with various content samples
2. Identify gaps or weaknesses
3. Update prompt in `insights-prompts.ts`
4. A/B test with real content
5. Measure quality improvement (user feedback, engagement metrics)

---

**Version:** 2.0
**Last Updated:** 2025-11-14
**Owner:** Engineering Team
**Status:** Production

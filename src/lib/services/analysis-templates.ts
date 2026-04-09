/**
 * Analysis Templates Service
 *
 * Provides content-type-aware prompt templates for AI analysis.
 * Optimizes document generation based on detected content characteristics.
 */

/**
 * Analysis type determines which specialized prompt template to use
 */
export type AnalysisType =
  | 'none' // Skip analysis entirely
  | 'meeting' // Meeting notes format
  | 'tutorial' // Step-by-step tutorial format
  | 'sop' // Standard Operating Procedure
  | 'demo' // Product demo/walkthrough
  | 'general'; // General summary (default)

/**
 * Metadata for customizing analysis prompts
 */
export interface AnalysisMetadata {
  /** Content title (e.g., "Q4 Planning Meeting") */
  title?: string;
  /** Duration in seconds */
  duration?: number;
  /** Whether visual events are available */
  hasVisualContext?: boolean;
  /** Additional context to include in prompt */
  customContext?: string;
}

/**
 * Meeting Notes Template
 *
 * Extracts structured meeting information with clear action items
 */
const MEETING_TEMPLATE = `You are a professional meeting analyst. Convert this transcript into structured meeting notes.

Focus on clarity, completeness, and actionability.

**Output Format:**

# Meeting Summary

## Overview
- **Date:** [Extract if mentioned]
- **Participants:** [List who attended]
- **Duration:** {duration}
- **Purpose:** [Brief purpose statement]

## Key Discussion Points
[3-5 major topics discussed with brief summaries]

## Decisions Made
[List concrete decisions with who made them]

## Action Items
[Format: "- [ ] [Task] - Assigned to: [Person] - Due: [Date]"]

## Next Steps
[What happens after this meeting]

## Open Questions
[Unresolved issues or topics needing follow-up]

---

**Instructions:**
- Be concise but complete
- Extract actual names, dates, and commitments
- Use bullet points for readability
- Highlight urgent items
- Note any disagreements or concerns raised`;

/**
 * Tutorial Template
 *
 * Creates step-by-step instructional content
 */
const TUTORIAL_TEMPLATE = `You are a technical instruction writer. Convert this content into a clear, step-by-step tutorial.

Focus on clarity, reproducibility, and helping users succeed.

**Output Format:**

# {title}

## Overview
[Brief description of what will be accomplished]

## Prerequisites
[What users need before starting]

## What You'll Learn
- [Key skill/concept 1]
- [Key skill/concept 2]
- [Key skill/concept 3]

## Steps

### Step 1: [Clear action title]
[Detailed instructions for this step]

{visual_context_instructions}

**Expected Result:** [What should happen after this step]

**Troubleshooting:** [Common issues and fixes]

### Step 2: [Next action title]
[Continue pattern...]

## Tips & Best Practices
[Helpful advice for better results]

## Common Mistakes to Avoid
[Pitfalls to watch out for]

## Next Steps
[What to learn or do next]

---

**Instructions:**
- Number steps clearly
- Be specific about UI elements (button names, locations)
- Include expected outcomes for each step
- Add troubleshooting for common issues
- Use simple, direct language`;

/**
 * SOP (Standard Operating Procedure) Template
 *
 * Creates formal procedure documentation
 */
const SOP_TEMPLATE = `You are a process documentation specialist. Convert this content into a formal Standard Operating Procedure (SOP).

Focus on precision, compliance, and repeatability.

**Output Format:**

# {title}

## Document Information
- **Version:** 1.0
- **Effective Date:** [Today's date]
- **Last Reviewed:** [Today's date]
- **Owner:** [Extract if mentioned]

## Purpose
[Why this procedure exists]

## Scope
[What this SOP covers and doesn't cover]

## Roles & Responsibilities
[Who does what in this process]

## Procedure

### Phase 1: [Phase Name]
**Responsible:** [Role]

1. [Specific action step]
   - **Decision Point:** [If applicable]
   - **Exception Handling:** [What to do if X happens]

2. [Next action step]
   {visual_context_instructions}

### Phase 2: [Next Phase]
[Continue pattern...]

## Quality Checks
[Verification steps to ensure correct execution]

## Compliance & Safety Notes
[Important warnings or regulatory requirements]

## Exception Handling
[What to do when things don't go as planned]

## Related Documents
[Links to related SOPs or policies]

---

**Instructions:**
- Use formal, precise language
- Include decision trees for conditional steps
- Specify who is responsible for each action
- Note compliance or safety requirements
- Document exception handling
- Be exhaustive - don't skip edge cases`;

/**
 * Demo/Walkthrough Template
 *
 * Highlights features and use cases
 */
const DEMO_TEMPLATE = `You are a product demonstration specialist. Convert this content into an engaging product walkthrough.

Focus on features, benefits, and use cases.

**Output Format:**

# {title}

## What This Is
[Brief product/feature description]

## Key Benefits
- [Benefit 1 with user value]
- [Benefit 2 with user value]
- [Benefit 3 with user value]

## Use Cases
[When and why someone would use this]

## Feature Walkthrough

### Feature 1: [Feature Name]
**What it does:** [Capability description]

**How it works:**
1. [Step with visual context]
2. [Next step]
{visual_context_instructions}

**Why it matters:** [User value/benefit]

**Pro tip:** [Advanced usage or shortcut]

### Feature 2: [Next Feature]
[Continue pattern...]

## UI Navigation Guide
[How to find and access key features]

## Best Practices
[How to get the most value from this product/feature]

## Common Questions
**Q:** [Question]
**A:** [Answer]

## What's Next
[Advanced features or related products to explore]

---

**Instructions:**
- Focus on benefits, not just features
- Use enthusiastic but professional tone
- Include actual UI element names and locations
- Explain WHY features exist, not just WHAT they do
- Anticipate user questions
- Highlight shortcuts and power-user tips`;

/**
 * General Template
 *
 * Flexible summary for any content type
 */
const GENERAL_TEMPLATE = `You are an expert content analyst. Create a well-structured, informative document from this content.

Focus on clarity, organization, and usefulness.

**Output Format:**

# {title}

## Summary
[2-3 sentence overview of the key points]

## Key Points
- [Important point 1]
- [Important point 2]
- [Important point 3]

## Detailed Content

### [Topic 1]
[Organized information with clear headings]

{visual_context_instructions}

### [Topic 2]
[Continue with logical flow]

## Takeaways
[What readers should remember or do]

---

**Instructions:**
- Organize information logically
- Use clear headings and hierarchy
- Preserve important details
- Make it scannable (use bullets/lists)
- Extract value, don't just transcribe`;

/**
 * Visual context enhancement for screen recordings
 */
const VISUAL_CONTEXT_ENHANCEMENT = `
**IMPORTANT:** This content includes visual information (what happened on screen).

When describing actions:
- Specify the EXACT button/field/element (e.g., "Click the blue 'Save' button")
- Include LOCATION details (e.g., "in the top right corner", "under the Settings menu")
- Use the actual text from buttons and UI labels
- Describe WHERE to look and WHAT to click

Example: "Click the gear icon ⚙️ in the top navigation bar, then select 'Advanced Settings' from the dropdown menu."
`;

/**
 * Template map for quick lookup
 */
const TEMPLATES: Record<AnalysisType, string | null> = {
  none: null,
  meeting: MEETING_TEMPLATE,
  tutorial: TUTORIAL_TEMPLATE,
  sop: SOP_TEMPLATE,
  demo: DEMO_TEMPLATE,
  general: GENERAL_TEMPLATE,
};

/**
 * Get the analysis prompt for a specific content type
 *
 * @param type - Analysis type to generate prompt for
 * @param metadata - Optional metadata to customize the prompt
 * @returns Formatted prompt string, or null if type is 'none'
 */
export function getAnalysisPrompt(
  type: AnalysisType,
  metadata?: AnalysisMetadata
): string | null {
  const template = TEMPLATES[type];

  if (!template) {
    return null;
  }

  let prompt = template;

  // Replace title placeholder
  if (metadata?.title) {
    prompt = prompt.replace(/{title}/g, metadata.title);
  } else {
    prompt = prompt.replace(/{title}/g, 'Content Analysis');
  }

  // Replace duration placeholder
  if (metadata?.duration) {
    const minutes = Math.floor(metadata.duration / 60);
    const seconds = metadata.duration % 60;
    const durationStr =
      minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    prompt = prompt.replace(/{duration}/g, durationStr);
  } else {
    prompt = prompt.replace(/{duration}/g, 'N/A');
  }

  // Replace visual context placeholder
  if (metadata?.hasVisualContext) {
    prompt = prompt.replace(
      /{visual_context_instructions}/g,
      VISUAL_CONTEXT_ENHANCEMENT
    );
  } else {
    prompt = prompt.replace(/{visual_context_instructions}/g, '');
  }

  // Append custom context if provided
  if (metadata?.customContext) {
    prompt += `\n\n**Additional Context:**\n${metadata.customContext}`;
  }

  return prompt;
}

/**
 * Get human-readable label for an analysis type
 *
 * @param type - Analysis type
 * @returns Display label
 */
export function getAnalysisTypeLabel(type: AnalysisType): string {
  const labels: Record<AnalysisType, string> = {
    none: 'No Analysis',
    meeting: 'Meeting Notes',
    tutorial: 'Tutorial',
    sop: 'Standard Operating Procedure',
    demo: 'Product Demo',
    general: 'General Summary',
  };

  return labels[type];
}

/**
 * Analysis type metadata for UI dropdowns and selection
 */
export interface AnalysisTypeOption {
  value: AnalysisType;
  label: string;
  description: string;
  icon?: string;
}

/**
 * List of all analysis types with metadata
 * Useful for building UI selection components
 */
export const ANALYSIS_TYPES: readonly AnalysisTypeOption[] = [
  {
    value: 'general',
    label: 'General Summary',
    description: 'Flexible format for any content type',
    icon: 'FileText',
  },
  {
    value: 'meeting',
    label: 'Meeting Notes',
    description: 'Extract decisions, action items, and key discussion points',
    icon: 'ClipboardList',
  },
  {
    value: 'tutorial',
    label: 'Tutorial',
    description: 'Step-by-step instructions with prerequisites and tips',
    icon: 'GraduationCap',
  },
  {
    value: 'sop',
    label: 'Standard Operating Procedure',
    description: 'Formal process documentation with roles and compliance',
    icon: 'FileCheck',
  },
  {
    value: 'demo',
    label: 'Product Demo',
    description: 'Feature walkthrough highlighting benefits and use cases',
    icon: 'Presentation',
  },
  {
    value: 'none',
    label: 'No Analysis',
    description: 'Skip AI analysis for this content',
    icon: 'FileX',
  },
] as const;

/**
 * Get analysis type option by value
 *
 * @param type - Analysis type to look up
 * @returns Analysis type option with metadata
 */
export function getAnalysisTypeOption(
  type: AnalysisType
): AnalysisTypeOption | undefined {
  return ANALYSIS_TYPES.find((option) => option.value === type);
}

/**
 * Validate if a string is a valid analysis type
 *
 * @param value - String to validate
 * @returns True if valid analysis type
 */
export function isValidAnalysisType(value: string): value is AnalysisType {
  const validTypes: AnalysisType[] = [
    'none',
    'meeting',
    'tutorial',
    'sop',
    'demo',
    'general',
  ];
  return validTypes.includes(value as AnalysisType);
}

/**
 * Get recommended analysis type based on content characteristics
 *
 * This is a simple heuristic-based recommendation. For more accurate
 * classification, use LLM-based content type detection.
 *
 * @param options - Content characteristics
 * @returns Recommended analysis type
 */
export function getRecommendedAnalysisType(options: {
  /** Content title or filename */
  title?: string;
  /** Content length in characters */
  contentLength?: number;
  /** Whether content has visual events */
  hasVisualContext?: boolean;
  /** Detected keywords in content */
  keywords?: string[];
}): AnalysisType {
  const { title = '', hasVisualContext = false, keywords = [] } = options;

  const titleLower = title.toLowerCase();
  const allKeywords = [...keywords.map((k) => k.toLowerCase()), titleLower];

  // Meeting detection
  if (
    allKeywords.some((k) =>
      ['meeting', 'sync', 'standup', 'retrospective', 'planning'].includes(k)
    )
  ) {
    return 'meeting';
  }

  // Tutorial detection (especially with visual context)
  if (
    hasVisualContext &&
    allKeywords.some((k) =>
      ['tutorial', 'how to', 'guide', 'walkthrough', 'learn'].includes(k)
    )
  ) {
    return 'tutorial';
  }

  // SOP detection
  if (
    allKeywords.some((k) =>
      ['sop', 'procedure', 'process', 'policy', 'standard'].includes(k)
    )
  ) {
    return 'sop';
  }

  // Demo detection
  if (
    hasVisualContext &&
    allKeywords.some((k) => ['demo', 'demonstration', 'showcase', 'feature'].includes(k))
  ) {
    return 'demo';
  }

  // Default to general
  return 'general';
}

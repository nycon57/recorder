/**
 * User-Friendly Processing Messages
 *
 * This file centralizes all user-facing messages for the upload/processing pipeline.
 * Messages are designed for non-technical users, focusing on benefits rather than system details.
 *
 * Design Principles:
 * - Use benefit-oriented language ("Making it searchable" vs "Creating embeddings")
 * - Explain WHAT the user gets, not HOW the system works
 * - Balance professional tone with encouraging, educational language
 * - Use possessive pronouns ("your content") to create ownership
 * - Avoid technical jargon (embeddings, vectors, jobs, position)
 */

/**
 * Processing Stage Definition
 */
export interface ProcessingStageConfig {
  /** Unique identifier for the stage */
  id: string;
  /** Main action label (what's happening now) */
  label: string;
  /** User benefit (what they're getting) */
  benefit: string;
  /** Additional context (why it matters) - optional */
  sublabel?: string;
  /** Emoji icon for visual recognition */
  icon: string;
  /** Color theme based on color psychology research */
  color: {
    icon: string;
    bg: string;
    border: string;
    text: string;
  };
}

/**
 * Simplified 3-Step Processing Flow
 *
 * Condensed from 5+ technical steps to 3 high-level stages users understand.
 * Each stage represents a meaningful milestone in the user journey.
 */
export const SIMPLIFIED_STAGES: ProcessingStageConfig[] = [
  {
    id: 'upload',
    label: 'Uploading',
    benefit: 'Securely transferring your content',
    icon: '📤',
    color: {
      icon: 'text-blue-600 dark:text-blue-500',
      bg: 'bg-blue-600 dark:bg-blue-500',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
    },
  },
  {
    id: 'processing',
    label: 'Processing',
    benefit: 'Analyzing and organizing your content',
    sublabel: 'Powering AI search and chat',
    icon: '🔄',
    color: {
      icon: 'text-purple-600 dark:text-purple-500',
      bg: 'bg-purple-600 dark:bg-purple-500',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
    },
  },
  {
    id: 'ready',
    label: 'Ready',
    benefit: 'Your content is searchable and ready to explore',
    icon: '✅',
    color: {
      icon: 'text-green-600 dark:text-green-500',
      bg: 'bg-green-600 dark:bg-green-500',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
    },
  },
];

/**
 * Detailed Processing Stages (for advanced/debugging view)
 *
 * These map backend job types to user-friendly descriptions.
 * Used when showing more granular progress (optional detailed view).
 */
export const DETAILED_STAGE_CONFIGS: Record<string, ProcessingStageConfig> = {
  upload: {
    id: 'upload',
    label: 'Uploading your file',
    benefit: 'Securely transferring your content',
    icon: '📤',
    color: {
      icon: 'text-blue-600 dark:text-blue-500',
      bg: 'bg-blue-600 dark:bg-blue-500',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
    },
  },
  extract_audio: {
    id: 'extract_audio',
    label: 'Preparing your audio',
    benefit: 'Getting ready to convert speech',
    icon: '🎵',
    color: {
      icon: 'text-indigo-600 dark:text-indigo-500',
      bg: 'bg-indigo-600 dark:bg-indigo-500',
      border: 'border-indigo-200 dark:border-indigo-800',
      text: 'text-indigo-700 dark:text-indigo-300',
    },
  },
  transcribe: {
    id: 'transcribe',
    label: 'Converting to text',
    benefit: 'Making your content readable and searchable',
    icon: '📝',
    color: {
      icon: 'text-indigo-600 dark:text-indigo-500',
      bg: 'bg-indigo-600 dark:bg-indigo-500',
      border: 'border-indigo-200 dark:border-indigo-800',
      text: 'text-indigo-700 dark:text-indigo-300',
    },
  },
  extract_text: {
    id: 'extract_text',
    label: 'Extracting text',
    benefit: 'Reading content from your document',
    icon: '📄',
    color: {
      icon: 'text-indigo-600 dark:text-indigo-500',
      bg: 'bg-indigo-600 dark:bg-indigo-500',
      border: 'border-indigo-200 dark:border-indigo-800',
      text: 'text-indigo-700 dark:text-indigo-300',
    },
  },
  process_text: {
    id: 'process_text',
    label: 'Organizing your text',
    benefit: 'Preparing your content for analysis',
    icon: '📋',
    color: {
      icon: 'text-violet-600 dark:text-violet-500',
      bg: 'bg-violet-600 dark:bg-violet-500',
      border: 'border-violet-200 dark:border-violet-800',
      text: 'text-violet-700 dark:text-violet-300',
    },
  },
  document: {
    id: 'document',
    label: 'Creating structured content',
    benefit: 'Generating AI-powered summary and insights',
    sublabel: 'This may take 15-30 seconds',
    icon: '✨',
    color: {
      icon: 'text-purple-600 dark:text-purple-500',
      bg: 'bg-purple-600 dark:bg-purple-500',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
    },
  },
  embeddings: {
    id: 'embeddings',
    label: 'Indexing for search',
    benefit: 'Making your content instantly searchable',
    icon: '🔍',
    color: {
      icon: 'text-emerald-600 dark:text-emerald-500',
      bg: 'bg-emerald-600 dark:bg-emerald-500',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
  },
  summary: {
    id: 'summary',
    label: 'Finalizing summary',
    benefit: 'Creating quick overview for easy reference',
    sublabel: 'Almost done!',
    icon: '📝',
    color: {
      icon: 'text-cyan-600 dark:text-cyan-500',
      bg: 'bg-cyan-600 dark:bg-cyan-500',
      border: 'border-cyan-200 dark:border-cyan-800',
      text: 'text-cyan-700 dark:text-cyan-300',
    },
  },
  complete: {
    id: 'complete',
    label: 'Ready to explore!',
    benefit: 'Your content is live in your library',
    icon: '🎉',
    color: {
      icon: 'text-green-600 dark:text-green-500',
      bg: 'bg-green-600 dark:bg-green-500',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
    },
  },
};

/**
 * Map backend job types to user-friendly stage IDs
 */
export const JOB_TYPE_TO_STAGE: Record<string, string> = {
  extract_audio: 'extract_audio',
  transcribe: 'transcribe',
  doc_generate: 'document',
  generate_embeddings: 'embeddings',
  generate_summary: 'summary', // Map to its own stage so it's visible
  extract_text_pdf: 'extract_text',
  extract_text_docx: 'extract_text',
  process_text_note: 'process_text',
};

/**
 * Map detailed stages to simplified stages
 */
export const DETAILED_TO_SIMPLIFIED: Record<string, string> = {
  upload: 'upload',
  extract_audio: 'processing',
  transcribe: 'processing',
  extract_text: 'processing',
  process_text: 'processing',
  document: 'processing',
  embeddings: 'processing',
  complete: 'ready',
};

/**
 * Content-Type Specific Messaging
 *
 * Customize stage labels based on content type for more relevant messaging.
 */
export const getContentTypeStages = (contentType: string): ProcessingStageConfig[] => {
  switch (contentType) {
    case 'video':
    case 'recording':
      return [
        {
          ...SIMPLIFIED_STAGES[0],
          label: 'Uploading your video',
        },
        {
          ...SIMPLIFIED_STAGES[1],
          benefit: 'Converting speech to text and analyzing content',
        },
        SIMPLIFIED_STAGES[2],
      ];

    case 'audio':
      return [
        {
          ...SIMPLIFIED_STAGES[0],
          label: 'Uploading your audio',
        },
        {
          ...SIMPLIFIED_STAGES[1],
          benefit: 'Converting speech to text',
        },
        SIMPLIFIED_STAGES[2],
      ];

    case 'document':
      return [
        {
          ...SIMPLIFIED_STAGES[0],
          label: 'Uploading your document',
        },
        {
          ...SIMPLIFIED_STAGES[1],
          benefit: 'Reading and analyzing your content',
        },
        SIMPLIFIED_STAGES[2],
      ];

    case 'text':
      return [
        {
          ...SIMPLIFIED_STAGES[0],
          label: 'Uploading your note',
        },
        {
          ...SIMPLIFIED_STAGES[1],
          benefit: 'Organizing and preparing your text',
        },
        SIMPLIFIED_STAGES[2],
      ];

    default:
      return SIMPLIFIED_STAGES;
  }
};

/**
 * Processing Tips
 *
 * Educational content shown during long processing times.
 * Helps users understand what they'll be able to do when processing completes.
 */
export const PROCESSING_TIPS = [
  '💡 Tip: Your content will be searchable with our AI assistant',
  '💡 Tip: You can chat with your content once processing completes',
  '💡 Tip: Summaries are automatically generated for easy reference',
  '💡 Tip: Close this window - we\'ll notify you when it\'s ready',
  '💡 Tip: All content is encrypted and secure',
  '💡 Tip: You can add tags and organize content after upload',
];

/**
 * Status Messages
 */
export const STATUS_MESSAGES = {
  connecting: 'Connecting to processing server...',
  connected: 'Connected - processing your content',
  disconnected: 'Processing complete',
  connectionError: 'Connection error - retrying...',

  complete: {
    title: 'Processing Complete!',
    description: 'Your content is ready and has been added to your library',
  },

  error: {
    title: 'Processing Failed',
    description: 'We encountered an error while processing your content',
  },

  longRunning: {
    title: 'Taking longer than expected',
    description: 'Large files may take several minutes. You can close this window and check back later.',
  },
};

/**
 * Get user-friendly label for a stage
 */
export function getStageLabel(stageId: string): string {
  return DETAILED_STAGE_CONFIGS[stageId]?.label || stageId;
}

/**
 * Get user-friendly benefit for a stage
 */
export function getStageBenefit(stageId: string): string {
  return DETAILED_STAGE_CONFIGS[stageId]?.benefit || '';
}

/**
 * Get stage configuration
 */
export function getStageConfig(stageId: string): ProcessingStageConfig | undefined {
  return DETAILED_STAGE_CONFIGS[stageId];
}

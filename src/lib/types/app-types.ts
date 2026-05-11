/**
 * Application-level type definitions for Tribora.
 *
 * These types are re-exported from @/lib/types/database so that all
 * consumers continue to work after the Supabase type regen replaced the
 * previous hand-written database.ts barrel.
 *
 * DO NOT auto-regenerate this file. These are stable domain types owned
 * by the application layer, not by the Supabase schema generator.
 */

// ─── Content & File Types ──────────────────────────────────────────────────

/**
 * Content type classification for knowledge items in the platform.
 * - 'recording': Screen recordings created in-app
 * - 'video': Uploaded video files (MP4, MOV, WEBM, AVI)
 * - 'audio': Uploaded audio files (MP3, WAV, M4A, OGG)
 * - 'document': Uploaded documents (PDF, DOCX, DOC)
 * - 'text': Direct text notes created by users
 */
export type ContentType = 'recording' | 'video' | 'audio' | 'document' | 'text';

/**
 * Supported file extensions for uploaded content.
 * Maps to specific processing pipelines and renderers.
 */
export type FileType =
  // Video formats
  | 'mp4'
  | 'mov'
  | 'webm'
  | 'avi'
  // Audio formats
  | 'mp3'
  | 'wav'
  | 'm4a'
  | 'ogg'
  // Document formats
  | 'pdf'
  | 'docx'
  | 'doc'
  // Text formats
  | 'txt'
  | 'md';

/**
 * Content processing status (applies to all content types).
 * Flow: uploading → uploaded → transcribing → transcribed → doc_generating → completed
 */
type ContentStatus =
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'doc_generating'
  | 'completed'
  | 'error';

/** @deprecated Use ContentStatus instead */
export type RecordingStatus = ContentStatus;

// ─── User & Org Types ──────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'contributor' | 'reader';

export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export type OrganizationPlan = 'free' | 'pro' | 'enterprise';

type Visibility = 'private' | 'department' | 'org' | 'public';

// ─── Job Types ─────────────────────────────────────────────────────────────

/**
 * Background job types for async processing pipeline.
 */
export type JobType =
  | 'transcribe'
  | 'doc_generate'
  | 'generate_embeddings'
  | 'generate_summary'
  | 'generate_metadata'
  | 'extract_frames'
  | 'extract_audio'
  | 'extract_text_pdf'
  | 'extract_text_docx'
  | 'process_text_note'
  | 'sync_connector'
  | 'process_imported_doc'
  | 'process_webhook'
  | 'compress_video'
  | 'compress_audio'
  | 'migrate_storage_tier'
  | 'deduplicate_file'
  | 'batch_deduplicate'
  | 'detect_similarity'
  | 'batch_detect_similarity'
  | 'collect_metrics'
  | 'generate_alerts'
  | 'generate_recommendations'
  | 'perform_health_check'
  | 'archive_search_metrics'
  | 'publish_document'
  | 'transcribe_segment'
  | 'merge_transcripts'
  | 'curate_knowledge'
  | 'analyze_knowledge_gaps'
  | 'generate_onboarding_plan'
  | 'generate_weekly_digest'
  | 'workflow_extraction'
  | 'compile_wiki'
  | 'ingest_vendor_docs';

// ─── Storage Types ─────────────────────────────────────────────────────────

/**
 * Storage tier classification for multi-tier storage strategy.
 */
export type StorageTier = 'hot' | 'warm' | 'cold' | 'glacier';

/**
 * Storage provider for multi-tier storage.
 */
export type StorageProvider = 'supabase' | 'r2';

// ─── Compression Types ─────────────────────────────────────────────────────

/**
 * Compression profiles for video and audio optimization.
 */
export type CompressionProfile =
  | 'screenRecording'
  | 'uploadedVideo'
  | 'highQuality'
  | 'audioVoice'
  | 'audioMusic';

export interface CompressionStats {
  original_size: number;
  compressed_size: number;
  compression_ratio: number;
  codec: string;
  crf: number;
  preset?: string;
  audio_codec?: string;
  audio_bitrate?: string;
  encoding_time_seconds: number;
  quality_score?: {
    vmaf?: number;
    ssim?: number;
  };
  profile: CompressionProfile;
  compressed_at: string;
}

export interface CompressVideoJobPayload {
  contentId: string;
  /** @deprecated Use contentId instead */
  recordingId?: string;
  orgId: string;
  inputPath: string;
  outputPath: string;
  profile: CompressionProfile;
  contentType: ContentType;
  fileType: FileType;
}

export interface CompressAudioJobPayload {
  contentId: string;
  /** @deprecated Use contentId instead */
  recordingId?: string;
  orgId: string;
  inputPath: string;
  outputPath: string;
  profile: CompressionProfile;
  contentType: ContentType;
  fileType: FileType;
}

export interface MigrateStorageTierJobPayload {
  contentId: string;
  /** @deprecated Use contentId instead */
  recordingId?: string;
  orgId: string;
  fromProvider: StorageProvider;
  fromTier: StorageTier;
  toTier: StorageTier;
  sourcePath: string;
  fileSize: number;
}

// ─── Permission & Approval Types ───────────────────────────────────────────

export type PermissionTier = 'auto' | 'notify' | 'approve';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// ─── Feedback & Agent Types ────────────────────────────────────────────────

export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'correction' | 'rating';

export type ActivityOutcome = 'success' | 'failure' | 'skipped' | 'pending_approval';

export type AgentGoalType = 'freshness' | 'coverage' | 'quality' | 'custom';

export type AgentGoalStatus = 'active' | 'paused' | 'achieved' | 'failed';

// ─── Knowledge & Workflow Types ────────────────────────────────────────────

export type KnowledgeGapSeverity = 'low' | 'medium' | 'high' | 'critical';

type KnowledgeGapStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

export type WorkflowStatus = 'draft' | 'published' | 'outdated' | 'archived';

/**
 * Individual step in a workflow extracted from screen recordings.
 */
export interface WorkflowStep {
  stepNumber: number;
  title: string;
  description: string;
  screenshotPath: string | null;
  timestamp: number;
  duration: number;
  uiElements: string[];
  action: string;
}

// ─── Onboarding Types ──────────────────────────────────────────────────────

/** Tracked engagement signal for a single content view. */
export interface ContentViewEvent {
  contentId: string;
  viewedAt: string;
  durationSec: number;
}

/** Structured engagement data stored in agent_onboarding_plans.engagement_data. */
export interface EngagementData {
  viewedContent: ContentViewEvent[];
  searchQueries: string[];
  chatQuestions: string[];
}

/**
 * Individual item in an onboarding plan learning path.
 */
export interface LearningPathItem {
  contentId: string;
  title: string;
  contentType: ContentType;
  reason: string;
  order: number;
  completed: boolean;
  completedAt: string | null;
  estimatedMinutes: number;
}

// ─── Tag Types ─────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface ContentTag {
  content_id: string;
  tag_id: string;
  created_at: string;
}

/** @deprecated Use ContentTag instead */
type RecordingTag = ContentTag;

// ─── Comments ──────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  content_id: string;
  user_id: string;
  org_id: string;
  parent_id: string | null;
  text: string;
  timestamp_sec: number | null;
  edited: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CommentWithUser extends Omit<Comment, 'org_id' | 'deleted_at'> {
  user_name: string;
  user_email: string;
}

// ─── Blog Types ────────────────────────────────────────────────────────────

export type BlogPostCategory = 'product' | 'insights' | 'tutorials' | 'general';

type BlogPostStatus = 'draft' | 'published' | 'archived';

export interface BlogPostCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: BlogPostCategory;
  tags: string[] | null;
  author_name: string;
  author_role: string | null;
  is_featured: boolean | null;
  reading_time_minutes: number | null;
  published_at: string | null;
}

export interface BlogPost extends BlogPostCard {
  content: string;
  author_avatar_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  featured_image_alt: string | null;
  view_count: number | null;
  status: BlogPostStatus;
  created_at: string | null;
  updated_at: string | null;
}

// ─── White-Label / Vendor Types ────────────────────────────────────────────

export interface WhiteLabelBranding {
  primary_color?: string;
  logo_url?: string;
  company_name?: string;
  [key: string]: unknown;
}

export interface WhiteLabelVoiceConfig {
  provider?: string;
  voice_id?: string;
  language?: string;
  [key: string]: unknown;
}

export interface WhiteLabelConfig {
  id: string;
  vendor_org_id: string;
  branding: WhiteLabelBranding;
  voice_config: WhiteLabelVoiceConfig;
  knowledge_scope: string[] | null;
  custom_domain: string | null;
  domain_verification_token: string | null;
  domain_verified: boolean;
  domain_verified_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type VendorApiKeyScope = 'query' | 'record' | 'admin';

export interface VendorApiKey {
  id: string;
  vendor_org_id: string;
  white_label_config_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: VendorApiKeyScope[] | null;
  is_active: boolean;
  rate_limit_rpm: number | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ─── Session / Activity Types ──────────────────────────────────────────────

type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

type OnboardingPlanStatus = 'active' | 'completed' | 'paused' | 'expired';

type SyncStatus = 'idle' | 'syncing' | 'error';

type ImportedDocumentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'error';

type DocumentStatus = 'generating' | 'generated' | 'edited' | 'error';

type ShareTargetType = 'recording' | 'document';

type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

type ConnectorType =
  | 'google_drive'
  | 'notion'
  | 'confluence'
  | 'file_upload'
  | 'url_import'
  | 'slack';

type SearchMode = 'standard' | 'agentic' | 'hybrid' | 'hierarchical';

type WebhookStatus = 'healthy' | 'degraded' | 'failing' | 'disabled';

type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'waiting'
  | 'dead_letter';

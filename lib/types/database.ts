// Database type definitions generated from schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationPlan = 'free' | 'pro' | 'enterprise';

export type UserRole = 'owner' | 'admin' | 'contributor' | 'reader';

export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export type Visibility = 'private' | 'department' | 'org' | 'public';

export type WebhookStatus = 'healthy' | 'degraded' | 'failing' | 'disabled';

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
export type ContentStatus =
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'doc_generating'
  | 'completed'
  | 'error';

/** @deprecated Use ContentStatus instead */
export type RecordingStatus = ContentStatus;

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Background job types for async processing pipeline.
 * - 'transcribe': Audio-to-text transcription via OpenAI Whisper
 * - 'doc_generate': Generate markdown documentation via GPT
 * - 'generate_embeddings': Create vector embeddings for semantic search
 * - 'generate_summary': Generate summary for recording
 * - 'extract_frames': Extract key frames from videos
 * - 'extract_audio': Extract audio track from video files
 * - 'extract_text_pdf': Extract text content from PDF documents
 * - 'extract_text_docx': Extract text content from DOCX documents
 * - 'process_text_note': Process user-created text notes
 * - 'sync_connector': Sync external connectors (Google Drive, Notion, etc.)
 * - 'process_imported_doc': Process documents imported from connectors
 * - 'process_webhook': Handle webhook events
 * - 'compress_video': Compress video files using H.265 codec
 * - 'compress_audio': Compress audio files using Opus/AAC codec
 * - 'migrate_storage_tier': Migrate files between storage tiers
 * - 'deduplicate_file': Deduplicate single file using SHA-256 hash
 * - 'batch_deduplicate': Batch deduplication for organization
 * - 'detect_similarity': Detect similar files using perceptual hashing
 * - 'batch_detect_similarity': Batch similarity detection for organization
 * - 'collect_metrics': Collect and aggregate storage metrics hourly
 * - 'generate_alerts': Generate alerts based on configured thresholds
 * - 'generate_recommendations': Analyze usage patterns and generate optimization recommendations
 * - 'perform_health_check': Monitor system health and log metrics
 * - 'archive_search_metrics': Archive search metrics from Redis to Supabase (90-day retention)
 * - 'transcribe_segment': Transcribe a single segment of a split long video (>30 min)
 * - 'merge_transcripts': Combine segment transcripts into final unified transcript
 */
export type JobType =
  | 'transcribe'
  | 'doc_generate'
  | 'generate_embeddings'
  | 'generate_summary'
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
  | 'merge_transcripts';

export type DocumentStatus = 'generating' | 'generated' | 'edited' | 'error';

export type ShareTargetType = 'recording' | 'document';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type ConnectorType =
  | 'google_drive'
  | 'notion'
  | 'confluence'
  | 'file_upload'
  | 'url_import'
  | 'slack';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export type ImportedDocumentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'error';

export type SearchMode = 'standard' | 'agentic' | 'hybrid' | 'hierarchical';

/**
 * Storage tier classification for multi-tier storage strategy.
 * - 'hot': Recent files in Supabase Storage (< 30 days) - $0.021/GB/month
 * - 'warm': Moderate-age files in Cloudflare R2 (30-180 days) - $0.015/GB/month
 * - 'cold': Archive files in Cloudflare R2 (> 180 days) - $0.01/GB/month
 * - 'glacier': Deep archive files in Cloudflare R2 (> 365 days) - $0.001/GB/month
 */
export type StorageTier = 'hot' | 'warm' | 'cold' | 'glacier';

/**
 * Storage provider for multi-tier storage.
 * - 'supabase': Supabase Storage (primary hot tier)
 * - 'r2': Cloudflare R2 (warm and cold tiers)
 */
export type StorageProvider = 'supabase' | 'r2';

/**
 * Compression profiles for video and audio optimization.
 * - 'screenRecording': Optimized for screen captures with high text readability (CRF 28-30)
 * - 'uploadedVideo': Balanced quality for camera footage (CRF 23-26)
 * - 'highQuality': Premium quality for important content (CRF 20-23)
 * - 'audioVoice': Voice-optimized audio compression (Opus 64kbps)
 * - 'audioMusic': Music-optimized audio compression (AAC 128kbps)
 */
export type CompressionProfile =
  | 'screenRecording'
  | 'uploadedVideo'
  | 'highQuality'
  | 'audioVoice'
  | 'audioMusic';

/**
 * Compression statistics stored in recordings.compression_stats JSONB field.
 * Tracks file size reduction, encoding parameters, and quality metrics.
 */
export interface CompressionStats {
  /** Original file size in bytes before compression */
  original_size: number;
  /** Compressed file size in bytes after compression */
  compressed_size: number;
  /** Compression ratio (original_size / compressed_size) */
  compression_ratio: number;
  /** Video codec used (e.g., 'libx265', 'libx264', 'vp9') */
  codec: string;
  /** Constant Rate Factor value used for encoding */
  crf: number;
  /** Encoding preset (e.g., 'slow', 'medium', 'fast') */
  preset?: string;
  /** Audio codec used (e.g., 'libopus', 'aac', 'mp3') */
  audio_codec?: string;
  /** Audio bitrate (e.g., '64k', '128k', '192k') */
  audio_bitrate?: string;
  /** Time taken to encode the file in seconds */
  encoding_time_seconds: number;
  /** Quality metrics comparing original vs compressed */
  quality_score?: {
    /** VMAF score (Video Multi-Method Assessment Fusion), 0-100 scale */
    vmaf?: number;
    /** SSIM score (Structural Similarity Index), 0-1 scale */
    ssim?: number;
  };
  /** Compression profile used */
  profile: CompressionProfile;
  /** Timestamp when compression was completed */
  compressed_at: string;
}

/**
 * Job payload for video compression tasks.
 */
export interface CompressVideoJobPayload {
  /** Content ID to compress */
  contentId: string;
  /** @deprecated Use contentId instead */
  recordingId?: string;
  /** Organization ID for the content */
  orgId: string;
  /** Storage path to input (raw) video file */
  inputPath: string;
  /** Storage path for output (compressed) video file */
  outputPath: string;
  /** Compression profile to use */
  profile: CompressionProfile;
  /** Content type of the content item */
  contentType: ContentType;
  /** File type of the content item */
  fileType: FileType;
}

/**
 * Job payload for audio compression tasks.
 */
export interface CompressAudioJobPayload {
  /** Content ID to compress */
  contentId: string;
  /** @deprecated Use contentId instead */
  recordingId?: string;
  /** Organization ID for the content */
  orgId: string;
  /** Storage path to input (raw) audio file */
  inputPath: string;
  /** Storage path for output (compressed) audio file */
  outputPath: string;
  /** Compression profile to use */
  profile: CompressionProfile;
  /** Content type of the content item */
  contentType: ContentType;
  /** File type of the content item */
  fileType: FileType;
}

/**
 * Job payload for storage tier migration tasks.
 */
export interface MigrateStorageTierJobPayload {
  /** Content ID to migrate */
  contentId: string;
  /** @deprecated Use contentId instead */
  recordingId?: string;
  /** Organization ID for the content */
  orgId: string;
  /** Current storage provider */
  fromProvider: StorageProvider;
  /** Current storage tier */
  fromTier: StorageTier;
  /** Target storage tier */
  toTier: StorageTier;
  /** Source storage path (Supabase or R2) */
  sourcePath: string;
  /** File size in bytes */
  fileSize: number;
}

export interface Tag {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ContentTag {
  content_id: string;
  tag_id: string;
  created_at: string;
}

/** @deprecated Use ContentTag instead */
export type RecordingTag = ContentTag;

/**
 * Comment on content with optional timestamp for video/audio
 */
export interface Comment {
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

/**
 * Comment with user details (from get_comments_with_users function)
 */
export interface CommentWithUser extends Omit<Comment, 'org_id' | 'deleted_at'> {
  user_name: string;
  user_email: string;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          clerk_org_id: string | null;
          plan: OrganizationPlan;
          settings: Json;
          billing_email: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          trial_ends_at: string | null;
          logo_url: string | null;
          primary_color: string | null;
          domain: string | null;
          features: Json;
          max_users: number | null;
          max_storage_gb: number | null;
          onboarded_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          clerk_org_id?: string | null;
          plan?: OrganizationPlan;
          settings?: Json;
          billing_email?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_ends_at?: string | null;
          logo_url?: string | null;
          primary_color?: string | null;
          domain?: string | null;
          features?: Json;
          max_users?: number | null;
          max_storage_gb?: number | null;
          onboarded_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          clerk_org_id?: string | null;
          plan?: OrganizationPlan;
          settings?: Json;
          billing_email?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_ends_at?: string | null;
          logo_url?: string | null;
          primary_color?: string | null;
          domain?: string | null;
          features?: Json;
          max_users?: number | null;
          max_storage_gb?: number | null;
          onboarded_at?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string; // UUID
          clerk_id: string; // Clerk user ID
          email: string;
          name: string | null;
          avatar_url: string | null;
          org_id: string;
          role: UserRole;
          title: string | null;
          department_id: string | null;
          bio: string | null;
          phone: string | null;
          timezone: string | null;
          invitation_token: string | null;
          invitation_expires_at: string | null;
          invited_by: string | null;
          onboarded_at: string | null;
          status: UserStatus | null;
          last_login_at: string | null;
          last_active_at: string | null;
          login_count: number | null;
          notification_preferences: Json;
          ui_preferences: Json;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string; // UUID, auto-generated
          clerk_id: string; // Clerk user ID
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          org_id: string;
          role: UserRole;
          title?: string | null;
          department_id?: string | null;
          bio?: string | null;
          phone?: string | null;
          timezone?: string | null;
          invitation_token?: string | null;
          invitation_expires_at?: string | null;
          invited_by?: string | null;
          onboarded_at?: string | null;
          status?: UserStatus | null;
          last_login_at?: string | null;
          last_active_at?: string | null;
          login_count?: number | null;
          notification_preferences?: Json;
          ui_preferences?: Json;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          clerk_id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          org_id?: string;
          role?: UserRole;
          title?: string | null;
          department_id?: string | null;
          bio?: string | null;
          phone?: string | null;
          timezone?: string | null;
          invitation_token?: string | null;
          invitation_expires_at?: string | null;
          invited_by?: string | null;
          onboarded_at?: string | null;
          status?: UserStatus | null;
          last_login_at?: string | null;
          last_active_at?: string | null;
          login_count?: number | null;
          notification_preferences?: Json;
          ui_preferences?: Json;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      /** Universal content table - stores all content types (recordings, videos, audio, documents, text) */
      content: {
        Row: {
          id: string;
          org_id: string;
          created_by: string;
          title: string | null;
          description: string | null;
          status: ContentStatus;
          duration_sec: number | null;
          storage_path_raw: string | null;
          storage_path_processed: string | null;
          thumbnail_url: string | null;
          error_message: string | null;
          metadata: Json;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          /** Content type classification (recording, video, audio, document, text) */
          content_type: ContentType | null;
          /** File extension (mp4, webm, mp3, pdf, etc.) */
          file_type: FileType | null;
          /** Original filename from upload */
          original_filename: string | null;
          /** MIME type for proper content handling */
          mime_type: string | null;
          /** File size in bytes */
          file_size: number | null;
          /** Compression statistics (file size reduction, quality metrics, encoding params) */
          compression_stats: CompressionStats | null;
          /** Storage tier for multi-tier storage strategy (hot, warm, cold) */
          storage_tier: StorageTier | null;
          /** Current storage provider (supabase or r2) */
          storage_provider: StorageProvider | null;
          /** Object key in Cloudflare R2 bucket (if stored in R2) */
          storage_path_r2: string | null;
          /** Timestamp when file was last migrated between tiers */
          tier_migrated_at: string | null;
          /** Flag indicating if tier migration job is scheduled */
          tier_migration_scheduled: boolean | null;
          /** Reference to original content if this is a deduplicated copy */
          deduplicated_from_content_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          created_by: string;
          title?: string | null;
          description?: string | null;
          status?: ContentStatus;
          duration_sec?: number | null;
          storage_path_raw?: string | null;
          storage_path_processed?: string | null;
          thumbnail_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          content_type?: ContentType | null;
          file_type?: FileType | null;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          compression_stats?: CompressionStats | null;
          storage_tier?: StorageTier | null;
          storage_provider?: StorageProvider | null;
          storage_path_r2?: string | null;
          tier_migrated_at?: string | null;
          tier_migration_scheduled?: boolean | null;
          deduplicated_from_content_id?: string | null;
        };
        Update: {
          title?: string | null;
          description?: string | null;
          status?: ContentStatus;
          duration_sec?: number | null;
          storage_path_raw?: string | null;
          storage_path_processed?: string | null;
          thumbnail_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          deleted_at?: string | null;
          updated_at?: string;
          completed_at?: string | null;
          content_type?: ContentType | null;
          file_type?: FileType | null;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          compression_stats?: CompressionStats | null;
          storage_tier?: StorageTier | null;
          storage_provider?: StorageProvider | null;
          storage_path_r2?: string | null;
          tier_migrated_at?: string | null;
          tier_migration_scheduled?: boolean | null;
          deduplicated_from_content_id?: string | null;
        };
      };
      /** @deprecated Use 'content' table instead */
      recordings: {
        Row: {
          id: string;
          org_id: string;
          created_by: string;
          title: string | null;
          description: string | null;
          status: ContentStatus;
          duration_sec: number | null;
          storage_path_raw: string | null;
          storage_path_processed: string | null;
          thumbnail_url: string | null;
          error_message: string | null;
          metadata: Json;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          content_type: ContentType | null;
          file_type: FileType | null;
          original_filename: string | null;
          mime_type: string | null;
          file_size: number | null;
          compression_stats: CompressionStats | null;
          storage_tier: StorageTier | null;
          storage_provider: StorageProvider | null;
          storage_path_r2: string | null;
          tier_migrated_at: string | null;
          tier_migration_scheduled: boolean | null;
          deduplicated_from_content_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          created_by: string;
          title?: string | null;
          description?: string | null;
          status?: ContentStatus;
          duration_sec?: number | null;
          storage_path_raw?: string | null;
          storage_path_processed?: string | null;
          thumbnail_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          content_type?: ContentType | null;
          file_type?: FileType | null;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          compression_stats?: CompressionStats | null;
          storage_tier?: StorageTier | null;
          storage_provider?: StorageProvider | null;
          storage_path_r2?: string | null;
          tier_migrated_at?: string | null;
          tier_migration_scheduled?: boolean | null;
          deduplicated_from_content_id?: string | null;
        };
        Update: {
          title?: string | null;
          description?: string | null;
          status?: ContentStatus;
          duration_sec?: number | null;
          storage_path_raw?: string | null;
          storage_path_processed?: string | null;
          thumbnail_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          deleted_at?: string | null;
          updated_at?: string;
          completed_at?: string | null;
          content_type?: ContentType | null;
          file_type?: FileType | null;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          compression_stats?: CompressionStats | null;
          storage_tier?: StorageTier | null;
          storage_provider?: StorageProvider | null;
          storage_path_r2?: string | null;
          tier_migrated_at?: string | null;
          tier_migration_scheduled?: boolean | null;
          deduplicated_from_content_id?: string | null;
        };
      };
      /** LLM-generated summaries for hierarchical retrieval */
      content_summaries: {
        Row: {
          id: string;
          content_id: string;
          org_id: string;
          summary_text: string;
          summary_embedding: number[] | null;
          model: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          org_id: string;
          summary_text: string;
          summary_embedding?: number[] | null;
          model?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          summary_text?: string;
          summary_embedding?: number[] | null;
          model?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
      };
      /** @deprecated Use content_summaries instead */
      recording_summaries: {
        Row: {
          id: string;
          content_id: string;
          org_id: string;
          summary_text: string;
          summary_embedding: number[] | null;
          model: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          org_id: string;
          summary_text: string;
          summary_embedding?: number[] | null;
          model?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          summary_text?: string;
          summary_embedding?: number[] | null;
          model?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
      };
      transcripts: {
        Row: {
          id: string;
          content_id: string;
          language: string;
          text: string;
          words_json: Json | null;
          confidence: number | null;
          provider: string | null;
          provider_job_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          language?: string;
          text: string;
          words_json?: Json | null;
          confidence?: number | null;
          provider?: string | null;
          provider_job_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          text?: string;
          words_json?: Json | null;
          confidence?: number | null;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          content_id: string;
          org_id: string;
          markdown: string;
          html: string | null;
          summary: string | null;
          version: string;
          model: string | null;
          is_published: boolean;
          status: DocumentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          org_id: string;
          markdown: string;
          html?: string | null;
          summary?: string | null;
          version?: string;
          model?: string | null;
          is_published?: boolean;
          status?: DocumentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          markdown?: string;
          html?: string | null;
          summary?: string | null;
          version?: string;
          is_published?: boolean;
          status?: DocumentStatus;
          updated_at?: string;
        };
      };
      transcript_chunks: {
        Row: {
          id: string;
          content_id: string;
          org_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[] | null;
          start_time_sec: number | null;
          end_time_sec: number | null;
          metadata: Json;
          model: string;
          chunking_strategy: 'fixed' | 'semantic' | 'adaptive' | 'hybrid' | null;
          semantic_score: number | null;
          structure_type: 'code' | 'list' | 'table' | 'paragraph' | 'heading' | 'mixed' | null;
          boundary_type: 'semantic_break' | 'size_limit' | 'structure_boundary' | 'topic_shift' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          org_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding?: number[] | null;
          start_time_sec?: number | null;
          end_time_sec?: number | null;
          metadata?: Json;
          model?: string;
          chunking_strategy?: 'fixed' | 'semantic' | 'adaptive' | 'hybrid' | null;
          semantic_score?: number | null;
          structure_type?: 'code' | 'list' | 'table' | 'paragraph' | 'heading' | 'mixed' | null;
          boundary_type?: 'semantic_break' | 'size_limit' | 'structure_boundary' | 'topic_shift' | null;
          created_at?: string;
        };
        Update: {
          embedding?: number[] | null;
          metadata?: Json;
          chunking_strategy?: 'fixed' | 'semantic' | 'adaptive' | 'hybrid' | null;
          semantic_score?: number | null;
          structure_type?: 'code' | 'list' | 'table' | 'paragraph' | 'heading' | 'mixed' | null;
          boundary_type?: 'semantic_break' | 'size_limit' | 'structure_boundary' | 'topic_shift' | null;
        };
      };
      jobs: {
        Row: {
          id: string;
          type: JobType;
          status: JobStatus;
          payload: Json;
          result: Json | null;
          error: string | null;
          attempts: number;
          max_attempts: number;
          run_at: string;
          started_at: string | null;
          completed_at: string | null;
          dedupe_key: string | null;
          progress_percent: number | null;
          progress_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: JobType;
          status?: JobStatus;
          payload: Json;
          result?: Json | null;
          error?: string | null;
          attempts?: number;
          max_attempts?: number;
          run_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          dedupe_key?: string | null;
          progress_percent?: number | null;
          progress_message?: string | null;
          created_at?: string;
        };
        Update: {
          status?: JobStatus;
          result?: Json | null;
          error?: string | null;
          attempts?: number;
          started_at?: string | null;
          completed_at?: string | null;
          progress_percent?: number | null;
          progress_message?: string | null;
        };
      };
      /** Temporary storage for video segment transcription results during long video (>30 min) processing */
      segment_transcripts: {
        Row: {
          id: string;
          content_id: string;
          parent_job_id: string | null;
          segment_index: number;
          segment_start_time: number;
          segment_duration: number;
          audio_transcript: Json;
          visual_events: Json;
          combined_narrative: string | null;
          key_moments: Json;
          processed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          parent_job_id?: string | null;
          segment_index: number;
          segment_start_time: number;
          segment_duration: number;
          audio_transcript?: Json;
          visual_events?: Json;
          combined_narrative?: string | null;
          key_moments?: Json;
          processed_at?: string;
          created_at?: string;
        };
        Update: {
          audio_transcript?: Json;
          visual_events?: Json;
          combined_narrative?: string | null;
          key_moments?: Json;
          processed_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          type: string;
          payload: Json;
          processed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          payload: Json;
          processed?: boolean;
          created_at?: string;
        };
        Update: {
          processed?: boolean;
        };
      };
      imported_documents: {
        Row: {
          id: string;
          connector_id: string;
          org_id: string;
          external_id: string;
          title: string | null;
          content: string | null;
          file_type: string | null;
          source_url: string | null;
          file_size_bytes: number | null;
          metadata: Json;
          sync_status: ImportedDocumentStatus;
          sync_error: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          connector_id: string;
          org_id: string;
          external_id: string;
          title?: string | null;
          content?: string | null;
          file_type?: string | null;
          source_url?: string | null;
          file_size_bytes?: number | null;
          metadata?: Json;
          sync_status?: ImportedDocumentStatus;
          sync_error?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          content?: string | null;
          file_type?: string | null;
          source_url?: string | null;
          file_size_bytes?: number | null;
          metadata?: Json;
          sync_status?: ImportedDocumentStatus;
          sync_error?: string | null;
          last_synced_at?: string | null;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string | null;
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message?: string | null;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
      };
      query_cache: {
        Row: {
          id: string;
          query_hash: string;
          query_text: string;
          query_embedding: number[] | null;
          results: Json;
          filters: Json;
          ttl: string;
          hit_count: number;
          created_at: string;
          last_accessed_at: string;
        };
        Insert: {
          id?: string;
          query_hash: string;
          query_text: string;
          query_embedding?: number[] | null;
          results: Json;
          filters?: Json;
          ttl: string;
          hit_count?: number;
          created_at?: string;
          last_accessed_at?: string;
        };
        Update: {
          query_embedding?: number[] | null;
          results?: Json;
          filters?: Json;
          ttl?: string;
          hit_count?: number;
          last_accessed_at?: string;
        };
      };
      shares: {
        Row: {
          id: string;
          org_id: string;
          target_type: ShareTargetType;
          target_id: string;
          share_id: string;
          password_hash: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          access_count: number;
          last_accessed_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          target_type: ShareTargetType;
          target_id: string;
          share_id?: string;
          password_hash?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          access_count?: number;
          last_accessed_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          password_hash?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          access_count?: number;
          last_accessed_at?: string | null;
        };
      };
      usage_counters: {
        Row: {
          org_id: string;
          period: string;
          minutes_transcribed: number;
          tokens_in: number;
          tokens_out: number;
          storage_gb: number;
          recordings_count: number;
          queries_count: number;
          updated_at: string;
        };
        Insert: {
          org_id: string;
          period?: string;
          minutes_transcribed?: number;
          tokens_in?: number;
          tokens_out?: number;
          storage_gb?: number;
          recordings_count?: number;
          queries_count?: number;
          updated_at?: string;
        };
        Update: {
          minutes_transcribed?: number;
          tokens_in?: number;
          tokens_out?: number;
          storage_gb?: number;
          recordings_count?: number;
          queries_count?: number;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          title: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          title?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
      };
      connector_configs: {
        Row: {
          id: string;
          org_id: string;
          connector_type: ConnectorType;
          name: string | null;
          credentials: Json;
          settings: Json;
          last_sync_at: string | null;
          sync_status: SyncStatus;
          sync_error: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          connector_type: ConnectorType;
          name?: string | null;
          credentials: Json;
          settings?: Json;
          last_sync_at?: string | null;
          sync_status?: SyncStatus;
          sync_error?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          connector_type?: ConnectorType;
          name?: string | null;
          credentials?: Json;
          settings?: Json;
          last_sync_at?: string | null;
          sync_status?: SyncStatus;
          sync_error?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: ChatRole;
          content: Json;
          tool_invocations: Json | null;
          sources: Json | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: ChatRole;
          content: Json;
          tool_invocations?: Json | null;
          sources?: Json | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          content?: Json;
          tool_invocations?: Json | null;
          sources?: Json | null;
          metadata?: Json;
        };
      };
      tags: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          updated_at?: string;
        };
      };
      /** Junction table linking content to tags */
      content_tags: {
        Row: {
          content_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          content_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      /** @deprecated Use content_tags instead */
      recording_tags: {
        Row: {
          content_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          content_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      search_analytics: {
        Row: {
          id: string;
          org_id: string | null;
          user_id: string | null;
          query: string;
          query_hash: string | null;
          results_count: number | null;
          latency_ms: number | null;
          mode: SearchMode | null;
          filters: Json;
          top_result_similarity: number | null;
          user_feedback: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          user_id?: string | null;
          query: string;
          query_hash?: string | null;
          results_count?: number | null;
          latency_ms?: number | null;
          mode?: SearchMode | null;
          filters?: Json;
          top_result_similarity?: number | null;
          user_feedback?: number | null;
          created_at?: string;
        };
        Update: {
          query?: string;
          query_hash?: string | null;
          results_count?: number | null;
          latency_ms?: number | null;
          mode?: SearchMode | null;
          filters?: Json;
          top_result_similarity?: number | null;
          user_feedback?: number | null;
        };
      };
      video_frames: {
        Row: {
          id: string;
          content_id: string;
          org_id: string;
          frame_time_sec: number;
          frame_url: string | null;
          visual_description: string | null;
          visual_embedding: number[] | null;
          ocr_text: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          org_id: string;
          frame_time_sec: number;
          frame_url?: string | null;
          visual_description?: string | null;
          visual_embedding?: number[] | null;
          ocr_text?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          frame_time_sec?: number;
          frame_url?: string | null;
          visual_description?: string | null;
          visual_embedding?: number[] | null;
          ocr_text?: string | null;
          metadata?: Json;
        };
      };
      departments: {
        Row: {
          id: string;
          org_id: string;
          parent_id: string | null;
          name: string;
          description: string | null;
          slug: string;
          default_visibility: Visibility | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          parent_id?: string | null;
          name: string;
          description?: string | null;
          slug: string;
          default_visibility?: Visibility | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          parent_id?: string | null;
          name?: string;
          description?: string | null;
          slug?: string;
          default_visibility?: Visibility | null;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      user_departments: {
        Row: {
          user_id: string;
          department_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          department_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      audit_logs: {
        Row: {
          id: string;
          org_id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          request_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          request_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      user_sessions: {
        Row: {
          id: string;
          user_id: string;
          org_id: string;
          session_token: string;
          clerk_session_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          device_type: string | null;
          browser: string | null;
          os: string | null;
          location: Json | null;
          created_at: string;
          last_active_at: string;
          expires_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          org_id: string;
          session_token: string;
          clerk_session_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          device_type?: string | null;
          browser?: string | null;
          os?: string | null;
          location?: Json | null;
          created_at?: string;
          last_active_at?: string;
          expires_at: string;
          revoked_at?: string | null;
        };
        Update: {
          last_active_at?: string;
          revoked_at?: string | null;
        };
      };
      user_invitations: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: UserRole;
          token: string;
          department_ids: string[];
          invited_by: string;
          custom_message: string | null;
          status: string;
          sent_at: string;
          expires_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
          reminder_sent_at: string | null;
          reminder_count: number | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role: UserRole;
          token?: string;
          department_ids?: string[];
          invited_by: string;
          custom_message?: string | null;
          status?: string;
          sent_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          reminder_sent_at?: string | null;
          reminder_count?: number | null;
          metadata?: Json;
        };
        Update: {
          status?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          reminder_sent_at?: string | null;
          reminder_count?: number | null;
        };
      };
      content_permissions: {
        Row: {
          id: string;
          org_id: string;
          resource_type: string;
          resource_id: string;
          visibility: Visibility;
          department_ids: string[] | null;
          allowed_user_ids: string[] | null;
          can_view: boolean | null;
          can_edit: boolean | null;
          can_delete: boolean | null;
          can_share: boolean | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          resource_type: string;
          resource_id: string;
          visibility?: Visibility;
          department_ids?: string[] | null;
          allowed_user_ids?: string[] | null;
          can_view?: boolean | null;
          can_edit?: boolean | null;
          can_delete?: boolean | null;
          can_share?: boolean | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          visibility?: Visibility;
          department_ids?: string[] | null;
          allowed_user_ids?: string[] | null;
          can_view?: boolean | null;
          can_edit?: boolean | null;
          can_delete?: boolean | null;
          can_share?: boolean | null;
          updated_at?: string;
        };
      };
      api_keys: {
        Row: {
          id: string;
          org_id: string;
          created_by: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes: string[];
          rate_limit: number | null;
          status: string;
          expires_at: string | null;
          last_used_at: string | null;
          usage_count: number | null;
          description: string | null;
          ip_whitelist: string[] | null;
          metadata: Json;
          created_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          created_by: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes?: string[];
          rate_limit?: number | null;
          status?: string;
          expires_at?: string | null;
          last_used_at?: string | null;
          usage_count?: number | null;
          description?: string | null;
          ip_whitelist?: string[] | null;
          metadata?: Json;
          created_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
        Update: {
          name?: string;
          scopes?: string[];
          rate_limit?: number | null;
          status?: string;
          expires_at?: string | null;
          last_used_at?: string | null;
          usage_count?: number | null;
          description?: string | null;
          ip_whitelist?: string[] | null;
          metadata?: Json;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
      };
      org_webhooks: {
        Row: {
          id: string;
          org_id: string;
          created_by: string;
          name: string;
          url: string;
          secret: string;
          events: string[];
          enabled: boolean | null;
          retry_enabled: boolean | null;
          max_retries: number | null;
          timeout_ms: number | null;
          headers: Json;
          last_triggered_at: string | null;
          last_success_at: string | null;
          last_failure_at: string | null;
          consecutive_failures: number | null;
          total_deliveries: number | null;
          successful_deliveries: number | null;
          failed_deliveries: number | null;
          status: WebhookStatus;
          description: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          created_by: string;
          name: string;
          url: string;
          secret: string;
          events?: string[];
          enabled?: boolean | null;
          retry_enabled?: boolean | null;
          max_retries?: number | null;
          timeout_ms?: number | null;
          headers?: Json;
          last_triggered_at?: string | null;
          last_success_at?: string | null;
          last_failure_at?: string | null;
          consecutive_failures?: number | null;
          total_deliveries?: number | null;
          successful_deliveries?: number | null;
          failed_deliveries?: number | null;
          status?: WebhookStatus;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          url?: string;
          secret?: string;
          events?: string[];
          enabled?: boolean | null;
          retry_enabled?: boolean | null;
          max_retries?: number | null;
          timeout_ms?: number | null;
          headers?: Json;
          last_triggered_at?: string | null;
          last_success_at?: string | null;
          last_failure_at?: string | null;
          consecutive_failures?: number | null;
          total_deliveries?: number | null;
          successful_deliveries?: number | null;
          failed_deliveries?: number | null;
          status?: WebhookStatus;
          description?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
      };
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          org_id: string;
          event_type: string;
          event_id: string | null;
          payload: Json;
          attempt_number: number | null;
          status: string;
          response_status_code: number | null;
          response_body: string | null;
          response_headers: Json | null;
          error_message: string | null;
          sent_at: string | null;
          completed_at: string | null;
          duration_ms: number | null;
          next_retry_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          webhook_id: string;
          org_id: string;
          event_type: string;
          event_id?: string | null;
          payload: Json;
          attempt_number?: number | null;
          status: string;
          response_status_code?: number | null;
          response_body?: string | null;
          response_headers?: Json | null;
          error_message?: string | null;
          sent_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          next_retry_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          attempt_number?: number | null;
          status?: string;
          response_status_code?: number | null;
          response_body?: string | null;
          response_headers?: Json | null;
          error_message?: string | null;
          sent_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          next_retry_at?: string | null;
          metadata?: Json;
        };
      };
    };
  };
}

// =============================================================================
// Blog Post Types
// =============================================================================

/**
 * Blog post status for publishing workflow.
 * - 'draft': Work in progress, not publicly visible
 * - 'published': Live and visible to the public
 * - 'archived': Hidden from public but preserved
 */
export type BlogPostStatus = 'draft' | 'published' | 'archived';

/**
 * Blog post category for content organization.
 */
export type BlogPostCategory = 'product' | 'insights' | 'tutorials' | 'general';

/**
 * Blog post record from the database.
 */
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: BlogPostCategory;
  tags: string[];
  author_name: string;
  author_role: string | null;
  author_avatar_url: string | null;
  status: BlogPostStatus;
  is_featured: boolean;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  reading_time_minutes: number;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Blog post for display (with formatted dates).
 */
export interface BlogPostDisplay extends Omit<BlogPost, 'published_at' | 'created_at' | 'updated_at'> {
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Blog post card data for archive listings.
 */
export interface BlogPostCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: BlogPostCategory;
  tags: string[];
  author_name: string;
  author_role: string | null;
  is_featured: boolean;
  reading_time_minutes: number;
  published_at: string | null;
}

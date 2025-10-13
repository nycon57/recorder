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

export type RecordingStatus =
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'doc_generating'
  | 'completed'
  | 'error';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type JobType =
  | 'transcribe'
  | 'doc_generate'
  | 'generate_embeddings'
  | 'generate_summary'
  | 'extract_frames'
  | 'sync_connector'
  | 'process_imported_doc'
  | 'process_webhook';

export type DocumentStatus = 'generating' | 'generated' | 'edited' | 'error';

export type ShareTargetType = 'recording' | 'document';

export type ChatRole = 'user' | 'assistant' | 'system';

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

export interface Tag {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface RecordingTag {
  recording_id: string;
  tag_id: string;
  created_at: string;
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
          updated_at?: string;
        };
      };
      recordings: {
        Row: {
          id: string;
          org_id: string;
          created_by: string;
          title: string | null;
          description: string | null;
          status: RecordingStatus;
          duration_sec: number | null;
          storage_path_raw: string | null;
          storage_path_processed: string | null;
          thumbnail_url: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          created_by: string;
          title?: string | null;
          description?: string | null;
          status?: RecordingStatus;
          duration_sec?: number | null;
          storage_path_raw?: string | null;
          storage_path_processed?: string | null;
          thumbnail_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          title?: string | null;
          description?: string | null;
          status?: RecordingStatus;
          duration_sec?: number | null;
          storage_path_raw?: string | null;
          storage_path_processed?: string | null;
          thumbnail_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          updated_at?: string;
          completed_at?: string | null;
        };
      };
      recording_summaries: {
        Row: {
          id: string;
          recording_id: string;
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
          recording_id: string;
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
          recording_id: string;
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
          recording_id: string;
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
          recording_id: string;
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
          recording_id: string;
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
          recording_id: string;
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
          recording_id: string;
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
          created_at?: string;
        };
        Update: {
          status?: JobStatus;
          result?: Json | null;
          error?: string | null;
          attempts?: number;
          started_at?: string | null;
          completed_at?: string | null;
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
      chat_conversations: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
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
          content: string;
          sources: Json | null;
          tokens: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: ChatRole;
          content: string;
          sources?: Json | null;
          tokens?: number | null;
          created_at?: string;
        };
        Update: {
          content?: string;
          sources?: Json | null;
          tokens?: number | null;
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
      recording_tags: {
        Row: {
          recording_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          recording_id: string;
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
          recording_id: string;
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
          recording_id: string;
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
    };
  };
}

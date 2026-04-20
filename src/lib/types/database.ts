export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ab_assignments: {
        Row: {
          assigned_at: string | null
          experiment_id: string
          id: string
          org_id: string
          user_id: string | null
          variant: string
        }
        Insert: {
          assigned_at?: string | null
          experiment_id: string
          id?: string
          org_id: string
          user_id?: string | null
          variant: string
        }
        Update: {
          assigned_at?: string | null
          experiment_id?: string
          id?: string
          org_id?: string
          user_id?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "ab_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_experiments: {
        Row: {
          created_at: string | null
          description: string | null
          ended_at: string | null
          feature: string
          id: string
          name: string
          started_at: string | null
          status: string | null
          traffic_allocation: Json
          variants: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          feature: string
          id?: string
          name: string
          started_at?: string | null
          status?: string | null
          traffic_allocation: Json
          variants: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          feature?: string
          id?: string
          name?: string
          started_at?: string | null
          status?: string | null
          traffic_allocation?: Json
          variants?: Json
        }
        Relationships: []
      }
      ab_metrics: {
        Row: {
          assignment_id: string
          created_at: string | null
          experiment_id: string
          id: string
          metadata: Json | null
          metric_name: string
          metric_value: number
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          experiment_id: string
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_value: number
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          experiment_id?: string
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ab_metrics_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "ab_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_metrics_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "ab_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      account: {
        Row: {
          accessToken: string | null
          accessTokenExpiresAt: string | null
          accountId: string
          createdAt: string
          id: string
          idToken: string | null
          password: string | null
          providerId: string
          refreshToken: string | null
          refreshTokenExpiresAt: string | null
          scope: string | null
          updatedAt: string
          userId: string
        }
        Insert: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId: string
          createdAt?: string
          id: string
          idToken?: string | null
          password?: string | null
          providerId: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt?: string
          userId: string
        }
        Update: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId?: string
          createdAt?: string
          id?: string
          idToken?: string | null
          password?: string | null
          providerId?: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt?: string
          userId?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action_type: Database["public"]["Enums"]["activity_action"]
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          resource_id: string
          resource_name: string | null
          resource_type: Database["public"]["Enums"]["activity_resource"]
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["activity_action"]
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          resource_id: string
          resource_name?: string | null
          resource_type: Database["public"]["Enums"]["activity_resource"]
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["activity_action"]
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          resource_id?: string
          resource_name?: string | null
          resource_type?: Database["public"]["Enums"]["activity_resource"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_activity_log: {
        Row: {
          action_type: string
          agent_type: string
          confidence: number | null
          content_id: string | null
          cost_estimate: number | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_summary: string | null
          metadata: Json | null
          org_id: string
          outcome: string
          output_summary: string | null
          target_entity: string | null
          target_id: string | null
          tokens_used: number | null
        }
        Insert: {
          action_type: string
          agent_type: string
          confidence?: number | null
          content_id?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          metadata?: Json | null
          org_id: string
          outcome?: string
          output_summary?: string | null
          target_entity?: string | null
          target_id?: string | null
          tokens_used?: number | null
        }
        Update: {
          action_type?: string
          agent_type?: string
          confidence?: number | null
          content_id?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          metadata?: Json | null
          org_id?: string
          outcome?: string
          output_summary?: string | null
          target_entity?: string | null
          target_id?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_log_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_activity_log_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      agent_approval_queue: {
        Row: {
          action_type: string
          agent_type: string
          content_id: string | null
          created_at: string | null
          description: string
          expires_at: string | null
          id: string
          org_id: string
          proposed_action: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          action_type: string
          agent_type: string
          content_id?: string | null
          created_at?: string | null
          description: string
          expires_at?: string | null
          id?: string
          org_id: string
          proposed_action: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          agent_type?: string
          content_id?: string | null
          created_at?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          proposed_action?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_approval_queue_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approval_queue_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      agent_feedback: {
        Row: {
          agent_activity_log_id: string | null
          comment: string | null
          correction_value: string | null
          created_at: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          org_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          agent_activity_log_id?: string | null
          comment?: string | null
          correction_value?: string | null
          created_at?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          agent_activity_log_id?: string | null
          comment?: string | null
          correction_value?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_feedback_agent_activity_log_id_fkey"
            columns: ["agent_activity_log_id"]
            isOneToOne: false
            referencedRelation: "agent_activity_log"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_goals: {
        Row: {
          agent_type: string
          created_at: string | null
          current_value: number | null
          goal_description: string
          goal_type: string
          id: string
          org_id: string
          priority: number | null
          status: string
          target_metric: string | null
          target_value: number | null
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          created_at?: string | null
          current_value?: number | null
          goal_description: string
          goal_type: string
          id?: string
          org_id: string
          priority?: number | null
          status?: string
          target_metric?: string | null
          target_value?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          current_value?: number | null
          goal_description?: string
          goal_type?: string
          id?: string
          org_id?: string
          priority?: number | null
          status?: string
          target_metric?: string | null
          target_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          access_count: number | null
          agent_type: string
          created_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number | null
          last_accessed_at: string | null
          memory_key: string
          memory_value: string
          metadata: Json | null
          org_id: string
          updated_at: string | null
        }
        Insert: {
          access_count?: number | null
          agent_type: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_accessed_at?: string | null
          memory_key: string
          memory_value: string
          metadata?: Json | null
          org_id: string
          updated_at?: string | null
        }
        Update: {
          access_count?: number | null
          agent_type?: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_accessed_at?: string | null
          memory_key?: string
          memory_value?: string
          metadata?: Json | null
          org_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_onboarding_plans: {
        Row: {
          completed_items: number | null
          created_at: string | null
          engagement_data: Json | null
          generated_by: string | null
          id: string
          learning_path: Json
          notes: string | null
          org_id: string
          plan_status: string
          reviewed_by: string | null
          total_items: number | null
          updated_at: string | null
          user_id: string
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          completed_items?: number | null
          created_at?: string | null
          engagement_data?: Json | null
          generated_by?: string | null
          id?: string
          learning_path?: Json
          notes?: string | null
          org_id: string
          plan_status?: string
          reviewed_by?: string | null
          total_items?: number | null
          updated_at?: string | null
          user_id: string
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          completed_items?: number | null
          created_at?: string | null
          engagement_data?: Json | null
          generated_by?: string | null
          id?: string
          learning_path?: Json
          notes?: string | null
          org_id?: string
          plan_status?: string
          reviewed_by?: string | null
          total_items?: number | null
          updated_at?: string | null
          user_id?: string
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      agent_permissions: {
        Row: {
          action_type: string
          agent_type: string
          created_at: string | null
          id: string
          is_enabled: boolean | null
          metadata: Json | null
          org_id: string
          permission_tier: string
          updated_at: string | null
        }
        Insert: {
          action_type: string
          agent_type: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          metadata?: Json | null
          org_id: string
          permission_tier?: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          agent_type?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          metadata?: Json | null
          org_id?: string
          permission_tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_sessions: {
        Row: {
          agent_type: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          goal: string | null
          id: string
          last_active_at: string | null
          metadata: Json | null
          org_id: string
          progress: Json | null
          session_status: string
          started_at: string | null
          state: Json | null
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          goal?: string | null
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          org_id: string
          progress?: Json | null
          session_status?: string
          started_at?: string | null
          state?: Json | null
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          goal?: string | null
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          org_id?: string
          progress?: Json | null
          session_status?: string
          started_at?: string | null
          state?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_usage: {
        Row: {
          action_type: string
          agent_type: string
          content_id: string | null
          created_at: string | null
          credits_consumed: number
          id: string
          model_used: string | null
          org_id: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          action_type: string
          agent_type: string
          content_id?: string | null
          created_at?: string | null
          credits_consumed?: number
          id?: string
          model_used?: string | null
          org_id: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          action_type?: string
          agent_type?: string
          content_id?: string | null
          created_at?: string | null
          credits_consumed?: number
          id?: string
          model_used?: string | null
          org_id?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_usage_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_usage_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      agentic_search_logs: {
        Row: {
          chunks_retrieved: number | null
          confidence_score: number | null
          created_at: string
          final_results: Json | null
          id: string
          iterations: Json | null
          org_id: string
          original_query: string
          query_intent: string | null
          reasoning_path: string | null
          subqueries: Json | null
          total_duration_ms: number | null
          user_id: string | null
        }
        Insert: {
          chunks_retrieved?: number | null
          confidence_score?: number | null
          created_at?: string
          final_results?: Json | null
          id?: string
          iterations?: Json | null
          org_id: string
          original_query: string
          query_intent?: string | null
          reasoning_path?: string | null
          subqueries?: Json | null
          total_duration_ms?: number | null
          user_id?: string | null
        }
        Update: {
          chunks_retrieved?: number | null
          confidence_score?: number | null
          created_at?: string
          final_results?: Json | null
          id?: string
          iterations?: Json | null
          org_id?: string
          original_query?: string
          query_intent?: string | null
          reasoning_path?: string | null
          subqueries?: Json | null
          total_duration_ms?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agentic_search_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agentic_search_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_config: {
        Row: {
          check_interval: number
          cost_threshold: number
          created_at: string | null
          enable_email_notifications: boolean
          enable_slack_notifications: boolean
          id: string
          organization_id: string
          slack_webhook_url: string | null
          storage_threshold: number
          updated_at: string | null
        }
        Insert: {
          check_interval?: number
          cost_threshold?: number
          created_at?: string | null
          enable_email_notifications?: boolean
          enable_slack_notifications?: boolean
          id?: string
          organization_id: string
          slack_webhook_url?: string | null
          storage_threshold?: number
          updated_at?: string | null
        }
        Update: {
          check_interval?: number
          cost_threshold?: number
          created_at?: string | null
          enable_email_notifications?: boolean
          enable_slack_notifications?: boolean
          id?: string
          organization_id?: string
          slack_webhook_url?: string | null
          storage_threshold?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_rule_id: string
          id: string
          metadata: Json | null
          metric_value: number | null
          notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          triggered_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_rule_id: string
          id?: string
          metadata?: Json | null
          metric_value?: number | null
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          triggered_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_rule_id?: string
          id?: string
          metadata?: Json | null
          metric_value?: number | null
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_incidents_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_incidents_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          condition: string
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean | null
          metric_name: string
          name: string
          notification_channels: string[] | null
          severity: string | null
          threshold: number
        }
        Insert: {
          condition: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean | null
          metric_name: string
          name: string
          notification_channels?: string[] | null
          severity?: string | null
          threshold: number
        }
        Update: {
          condition?: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean | null
          metric_name?: string
          name?: string
          notification_channels?: string[] | null
          severity?: string | null
          threshold?: number
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string | null
          details: string | null
          id: string
          message: string
          organization_id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          type: string
          updated_at: string | null
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          message: string
          organization_id: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          type: string
          updated_at?: string | null
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          message?: string
          organization_id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          ip_whitelist: unknown[] | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          metadata: Json | null
          name: string
          org_id: string
          rate_limit: number | null
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[] | null
          status: string
          usage_count: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          metadata?: Json | null
          name: string
          org_id: string
          rate_limit?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[] | null
          status?: string
          usage_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          metadata?: Json | null
          name?: string
          org_id?: string
          rate_limit?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[] | null
          status?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          org_id: string
          request_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          org_id: string
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          author_role: string | null
          canonical_url: string | null
          category: string
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image_alt: string | null
          featured_image_url: string | null
          id: string
          is_featured: boolean | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          reading_time_minutes: number | null
          slug: string
          status: Database["public"]["Enums"]["blog_post_status"]
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name: string
          author_role?: string | null
          canonical_url?: string | null
          category?: string
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          slug: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          author_role?: string | null
          canonical_url?: string | null
          category?: string
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      budget_tracking: {
        Row: {
          created_at: string | null
          current_spend: number
          id: string
          month: number
          monthly_budget: number
          organization_id: string
          projected_spend: number
          status: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          current_spend?: number
          id?: string
          month: number
          monthly_budget?: number
          organization_id: string
          projected_spend?: number
          status?: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          current_spend?: number
          id?: string
          month?: number
          monthly_budget?: number
          organization_id?: string
          projected_spend?: number
          status?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: Json
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          sources: Json | null
          tool_invocations: Json | null
        }
        Insert: {
          content: Json
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          sources?: Json | null
          tool_invocations?: Json | null
        }
        Update: {
          content?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          sources?: Json | null
          tool_invocations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          added_at: string
          added_by: string
          collection_id: string
          content_id: string
          position: number | null
        }
        Insert: {
          added_at?: string
          added_by: string
          collection_id: string
          content_id: string
          position?: number | null
        }
        Update: {
          added_at?: string
          added_by?: string
          collection_id?: string
          content_id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      collections: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          depth: number | null
          description: string | null
          icon: string | null
          id: string
          name: string
          org_id: string
          parent_id: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          depth?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          org_id: string
          parent_id?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          depth?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          org_id?: string
          parent_id?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_mentions: {
        Row: {
          chunk_id: string | null
          concept_id: string
          confidence: number | null
          content_id: string
          context: string | null
          created_at: string | null
          id: string
          org_id: string
          timestamp_sec: number | null
        }
        Insert: {
          chunk_id?: string | null
          concept_id: string
          confidence?: number | null
          content_id: string
          context?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          timestamp_sec?: number | null
        }
        Update: {
          chunk_id?: string | null
          concept_id?: string
          confidence?: number | null
          content_id?: string
          context?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          timestamp_sec?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_mentions_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "transcript_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_mentions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "knowledge_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_mentions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_mentions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      concept_relationships: {
        Row: {
          concept_a_id: string
          concept_b_id: string
          created_at: string | null
          evidence_count: number | null
          id: string
          org_id: string
          relationship_type: string
          strength: number | null
          updated_at: string | null
        }
        Insert: {
          concept_a_id: string
          concept_b_id: string
          created_at?: string | null
          evidence_count?: number | null
          id?: string
          org_id: string
          relationship_type: string
          strength?: number | null
          updated_at?: string | null
        }
        Update: {
          concept_a_id?: string
          concept_b_id?: string
          created_at?: string | null
          evidence_count?: number | null
          id?: string
          org_id?: string
          relationship_type?: string
          strength?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_relationships_concept_a_id_fkey"
            columns: ["concept_a_id"]
            isOneToOne: false
            referencedRelation: "knowledge_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_relationships_concept_b_id_fkey"
            columns: ["concept_b_id"]
            isOneToOne: false
            referencedRelation: "knowledge_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_configs: {
        Row: {
          connector_type: string
          created_at: string | null
          created_by: string | null
          credentials: Json
          credentials_updated_at: string | null
          description: string | null
          error_count: number | null
          filters: Json | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_error_at: string | null
          last_publish_at: string | null
          last_sync_at: string | null
          name: string | null
          next_sync_at: string | null
          org_id: string
          publish_scopes: string[] | null
          settings: Json | null
          supports_publish: boolean | null
          sync_error: string | null
          sync_frequency: string | null
          sync_status: string | null
          updated_at: string | null
          webhook_active: boolean | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          connector_type: string
          created_at?: string | null
          created_by?: string | null
          credentials: Json
          credentials_updated_at?: string | null
          description?: string | null
          error_count?: number | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_error_at?: string | null
          last_publish_at?: string | null
          last_sync_at?: string | null
          name?: string | null
          next_sync_at?: string | null
          org_id: string
          publish_scopes?: string[] | null
          settings?: Json | null
          supports_publish?: boolean | null
          sync_error?: string | null
          sync_frequency?: string | null
          sync_status?: string | null
          updated_at?: string | null
          webhook_active?: boolean | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          connector_type?: string
          created_at?: string | null
          created_by?: string | null
          credentials?: Json
          credentials_updated_at?: string | null
          description?: string | null
          error_count?: number | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_error_at?: string | null
          last_publish_at?: string | null
          last_sync_at?: string | null
          name?: string | null
          next_sync_at?: string | null
          org_id?: string
          publish_scopes?: string[] | null
          settings?: Json | null
          supports_publish?: boolean | null
          sync_error?: string | null
          sync_frequency?: string | null
          sync_status?: string | null
          updated_at?: string | null
          webhook_active?: boolean | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_sync_logs: {
        Row: {
          api_calls_made: number | null
          bytes_transferred: number | null
          completed_at: string | null
          connector_id: string | null
          documents_deleted: number | null
          documents_failed: number | null
          documents_synced: number | null
          documents_updated: number | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          id: string
          metadata: Json | null
          org_id: string
          started_at: string | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          api_calls_made?: number | null
          bytes_transferred?: number | null
          completed_at?: string | null
          connector_id?: string | null
          documents_deleted?: number | null
          documents_failed?: number | null
          documents_synced?: number | null
          documents_updated?: number | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          api_calls_made?: number | null
          bytes_transferred?: number | null
          completed_at?: string | null
          connector_id?: string | null
          documents_deleted?: number | null
          documents_failed?: number | null
          documents_synced?: number | null
          documents_updated?: number | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_sync_logs_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_sync_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_sync_state: {
        Row: {
          connector_id: string
          content_hash: string | null
          content_id: string
          created_at: string
          external_id: string
          external_metadata: Json | null
          external_version: string | null
          id: string
          last_modified_external: string | null
          last_synced_at: string | null
          retry_count: number | null
          sync_direction: string | null
          sync_error: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          connector_id: string
          content_hash?: string | null
          content_id: string
          created_at?: string
          external_id: string
          external_metadata?: Json | null
          external_version?: string | null
          id?: string
          last_modified_external?: string | null
          last_synced_at?: string | null
          retry_count?: number | null
          sync_direction?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          connector_id?: string
          content_hash?: string | null
          content_id?: string
          created_at?: string
          external_id?: string
          external_metadata?: Json | null
          external_version?: string | null
          id?: string
          last_modified_external?: string | null
          last_synced_at?: string | null
          retry_count?: number | null
          sync_direction?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_sync_state_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_sync_state_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_sync_state_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      connector_webhook_events: {
        Row: {
          connector_id: string | null
          event_id: string | null
          event_source: string | null
          event_type: string
          headers: Json | null
          id: string
          org_id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          received_at: string | null
          retry_count: number | null
        }
        Insert: {
          connector_id?: string | null
          event_id?: string | null
          event_source?: string | null
          event_type: string
          headers?: Json | null
          id?: string
          org_id: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
          retry_count?: number | null
        }
        Update: {
          connector_id?: string | null
          event_id?: string | null
          event_source?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          org_id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
          retry_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_webhook_events_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          analysis_type: string
          audio_hash: string | null
          collection_id: string | null
          completed_at: string | null
          completed_segments: number | null
          compression_rate: number | null
          compression_stats: Json | null
          content_type: string
          created_at: string
          created_by: string
          deduplicated_from_content_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          description: string | null
          duration_sec: number | null
          embeddings_updated_at: string | null
          error_message: string | null
          estimated_completion_at: string | null
          file_hash: string | null
          file_size: number | null
          file_type: string | null
          frame_count: number | null
          frames_extracted: boolean | null
          id: string
          is_deduplicated: boolean | null
          metadata: Json | null
          mime_type: string | null
          org_id: string
          original_filename: string | null
          processing_strategy:
            | Database["public"]["Enums"]["processing_strategy"]
            | null
          reference_count: number | null
          similarity_processed_at: string | null
          skip_analysis: boolean
          source_connector_id: string | null
          source_external_id: string | null
          source_type: string
          source_url: string | null
          status: string
          storage_path_processed: string | null
          storage_path_r2: string | null
          storage_path_raw: string | null
          storage_provider:
            | Database["public"]["Enums"]["storage_provider"]
            | null
          storage_tier: Database["public"]["Enums"]["storage_tier"] | null
          thumbnail_url: string | null
          tier_migrated_at: string | null
          tier_migration_scheduled: boolean | null
          title: string | null
          total_segments: number | null
          updated_at: string
          video_hash: string | null
          visual_indexing_status: string | null
        }
        Insert: {
          analysis_type?: string
          audio_hash?: string | null
          collection_id?: string | null
          completed_at?: string | null
          completed_segments?: number | null
          compression_rate?: number | null
          compression_stats?: Json | null
          content_type?: string
          created_at?: string
          created_by: string
          deduplicated_from_content_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          duration_sec?: number | null
          embeddings_updated_at?: string | null
          error_message?: string | null
          estimated_completion_at?: string | null
          file_hash?: string | null
          file_size?: number | null
          file_type?: string | null
          frame_count?: number | null
          frames_extracted?: boolean | null
          id?: string
          is_deduplicated?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          org_id: string
          original_filename?: string | null
          processing_strategy?:
            | Database["public"]["Enums"]["processing_strategy"]
            | null
          reference_count?: number | null
          similarity_processed_at?: string | null
          skip_analysis?: boolean
          source_connector_id?: string | null
          source_external_id?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          storage_path_processed?: string | null
          storage_path_r2?: string | null
          storage_path_raw?: string | null
          storage_provider?:
            | Database["public"]["Enums"]["storage_provider"]
            | null
          storage_tier?: Database["public"]["Enums"]["storage_tier"] | null
          thumbnail_url?: string | null
          tier_migrated_at?: string | null
          tier_migration_scheduled?: boolean | null
          title?: string | null
          total_segments?: number | null
          updated_at?: string
          video_hash?: string | null
          visual_indexing_status?: string | null
        }
        Update: {
          analysis_type?: string
          audio_hash?: string | null
          collection_id?: string | null
          completed_at?: string | null
          completed_segments?: number | null
          compression_rate?: number | null
          compression_stats?: Json | null
          content_type?: string
          created_at?: string
          created_by?: string
          deduplicated_from_content_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          duration_sec?: number | null
          embeddings_updated_at?: string | null
          error_message?: string | null
          estimated_completion_at?: string | null
          file_hash?: string | null
          file_size?: number | null
          file_type?: string | null
          frame_count?: number | null
          frames_extracted?: boolean | null
          id?: string
          is_deduplicated?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          org_id?: string
          original_filename?: string | null
          processing_strategy?:
            | Database["public"]["Enums"]["processing_strategy"]
            | null
          reference_count?: number | null
          similarity_processed_at?: string | null
          skip_analysis?: boolean
          source_connector_id?: string | null
          source_external_id?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          storage_path_processed?: string | null
          storage_path_r2?: string | null
          storage_path_raw?: string | null
          storage_provider?:
            | Database["public"]["Enums"]["storage_provider"]
            | null
          storage_tier?: Database["public"]["Enums"]["storage_tier"] | null
          thumbnail_url?: string | null
          tier_migrated_at?: string | null
          tier_migration_scheduled?: boolean | null
          title?: string | null
          total_segments?: number | null
          updated_at?: string
          video_hash?: string | null
          visual_indexing_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_deduplicated_from_fkey"
            columns: ["deduplicated_from_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_deduplicated_from_fkey"
            columns: ["deduplicated_from_content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "content_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_source_connector_id_fkey"
            columns: ["source_connector_id"]
            isOneToOne: false
            referencedRelation: "connector_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_permissions: {
        Row: {
          allowed_user_ids: string[] | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_share: boolean | null
          can_view: boolean | null
          created_at: string
          created_by: string | null
          department_ids: string[] | null
          id: string
          org_id: string
          resource_id: string
          resource_type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          allowed_user_ids?: string[] | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_share?: boolean | null
          can_view?: boolean | null
          created_at?: string
          created_by?: string | null
          department_ids?: string[] | null
          id?: string
          org_id: string
          resource_id: string
          resource_type: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          allowed_user_ids?: string[] | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_share?: boolean | null
          can_view?: boolean | null
          created_at?: string
          created_by?: string | null
          department_ids?: string[] | null
          id?: string
          org_id?: string
          resource_id?: string
          resource_type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_processing_events: {
        Row: {
          content_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          segment_index: number | null
        }
        Insert: {
          content_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          segment_index?: number | null
        }
        Update: {
          content_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          segment_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_processing_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_processing_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      content_summaries: {
        Row: {
          content_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          model: string | null
          org_id: string
          summary_embedding: string | null
          summary_text: string
          updated_at: string | null
        }
        Insert: {
          content_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          org_id: string
          summary_embedding?: string | null
          summary_text: string
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          org_id?: string
          summary_embedding?: string | null
          summary_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_summaries_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_summaries_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "content_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_tags: {
        Row: {
          content_id: string
          created_at: string
          created_by: string | null
          tag_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          created_by?: string | null
          tag_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          created_by?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "content_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      content_views: {
        Row: {
          content_id: string
          created_at: string | null
          id: string
          ip_address: unknown
          org_id: string
          referrer: string | null
          session_id: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
          view_duration_sec: number | null
          viewed_at: string
        }
        Insert: {
          content_id: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          org_id: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_duration_sec?: number | null
          viewed_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          org_id?: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_duration_sec?: number | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "content_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          default_visibility: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_visibility?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_visibility?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content_id: string
          created_at: string
          has_publications: boolean | null
          html: string | null
          id: string
          is_published: boolean | null
          markdown: string
          metadata: Json | null
          model: string | null
          needs_embeddings_refresh: boolean | null
          org_id: string
          publication_count: number | null
          status: string
          summary: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          content_id: string
          created_at?: string
          has_publications?: boolean | null
          html?: string | null
          id?: string
          is_published?: boolean | null
          markdown: string
          metadata?: Json | null
          model?: string | null
          needs_embeddings_refresh?: boolean | null
          org_id: string
          publication_count?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string
          has_publications?: boolean | null
          html?: string | null
          id?: string
          is_published?: boolean | null
          markdown?: string
          metadata?: Json | null
          model?: string | null
          needs_embeddings_refresh?: boolean | null
          org_id?: string
          publication_count?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          processed: boolean | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          processed?: boolean | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          type?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          content_id: string
          created_at: string
          id: string
          org_id: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          org_id: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "favorites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      file_references: {
        Row: {
          content_id: string
          created_at: string | null
          file_size: number
          id: string
          original_content_id: string
        }
        Insert: {
          content_id: string
          created_at?: string | null
          file_size: number
          id?: string
          original_content_id: string
        }
        Update: {
          content_id?: string
          created_at?: string | null
          file_size?: number
          id?: string
          original_content_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_references_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_references_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "file_references_original_content_id_fkey"
            columns: ["original_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_references_original_content_id_fkey"
            columns: ["original_content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      file_upload_batches: {
        Row: {
          batch_name: string | null
          completed_at: string | null
          created_at: string | null
          failed_files: number | null
          id: string
          metadata: Json | null
          org_id: string
          processed_files: number | null
          progress_percent: number | null
          status: string | null
          total_files: number
          user_id: string | null
        }
        Insert: {
          batch_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          failed_files?: number | null
          id?: string
          metadata?: Json | null
          org_id: string
          processed_files?: number | null
          progress_percent?: number | null
          status?: string | null
          total_files: number
          user_id?: string | null
        }
        Update: {
          batch_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          failed_files?: number | null
          id?: string
          metadata?: Json | null
          org_id?: string
          processed_files?: number | null
          progress_percent?: number | null
          status?: string | null
          total_files?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_upload_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_upload_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_documents: {
        Row: {
          chunks_generated: boolean | null
          connector_id: string
          content: string | null
          content_hash: string | null
          created_at: string | null
          embeddings_generated: boolean | null
          external_id: string
          external_url: string | null
          file_size: number | null
          file_type: string | null
          first_synced_at: string | null
          id: string
          is_deleted: boolean | null
          last_synced_at: string | null
          metadata: Json | null
          org_id: string
          parent_external_id: string | null
          processing_error: string | null
          processing_status: string | null
          source_metadata: Json | null
          sync_count: number | null
          sync_error: string | null
          sync_status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          chunks_generated?: boolean | null
          connector_id: string
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          embeddings_generated?: boolean | null
          external_id: string
          external_url?: string | null
          file_size?: number | null
          file_type?: string | null
          first_synced_at?: string | null
          id?: string
          is_deleted?: boolean | null
          last_synced_at?: string | null
          metadata?: Json | null
          org_id: string
          parent_external_id?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_metadata?: Json | null
          sync_count?: number | null
          sync_error?: string | null
          sync_status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          chunks_generated?: boolean | null
          connector_id?: string
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          embeddings_generated?: boolean | null
          external_id?: string
          external_url?: string | null
          file_size?: number | null
          file_type?: string | null
          first_synced_at?: string | null
          id?: string
          is_deleted?: boolean | null
          last_synced_at?: string | null
          metadata?: Json | null
          org_id?: string
          parent_external_id?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_metadata?: Json | null
          sync_count?: number | null
          sync_error?: string | null
          sync_status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_documents_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation: {
        Row: {
          email: string
          expiresAt: string
          id: string
          inviterId: string
          organizationId: string
          role: string | null
          status: string
        }
        Insert: {
          email: string
          expiresAt: string
          id: string
          inviterId: string
          organizationId: string
          role?: string | null
          status?: string
        }
        Update: {
          email?: string
          expiresAt?: string
          id?: string
          inviterId?: string
          organizationId?: string
          role?: string | null
          status?: string
        }
        Relationships: []
      }
      item_views: {
        Row: {
          content_id: string
          duration_seconds: number | null
          id: string
          ip_address: unknown
          org_id: string
          user_agent: string | null
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          content_id: string
          duration_seconds?: number | null
          id?: string
          ip_address?: unknown
          org_id: string
          user_agent?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          content_id?: string
          duration_seconds?: number | null
          id?: string
          ip_address?: unknown
          org_id?: string
          user_agent?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "item_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          content_id: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          max_attempts: number | null
          parent_job_id: string | null
          payload: Json
          priority: number | null
          progress_message: string | null
          progress_percent: number | null
          result: Json | null
          run_at: string
          segments_completed: number | null
          started_at: string | null
          status: string
          total_segments: number | null
          type: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          content_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          max_attempts?: number | null
          parent_job_id?: string | null
          payload: Json
          priority?: number | null
          progress_message?: string | null
          progress_percent?: number | null
          result?: Json | null
          run_at?: string
          segments_completed?: number | null
          started_at?: string | null
          status?: string
          total_segments?: number | null
          type: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          content_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          max_attempts?: number | null
          parent_job_id?: string | null
          payload?: Json
          priority?: number | null
          progress_message?: string | null
          progress_percent?: number | null
          result?: Json | null
          run_at?: string
          segments_completed?: number | null
          started_at?: string | null
          status?: string
          total_segments?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_concepts: {
        Row: {
          concept_type: string
          created_at: string | null
          description: string | null
          embedding: string | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          mention_count: number | null
          name: string
          normalized_name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          concept_type?: string
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          mention_count?: number | null
          name: string
          normalized_name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          concept_type?: string
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          mention_count?: number | null
          name?: string
          normalized_name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_gaps: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          impact_score: number | null
          last_searched_at: string | null
          metadata: Json | null
          org_id: string
          related_concept_ids: string[] | null
          resolved_at: string | null
          resolved_by_content_id: string | null
          search_count: number | null
          severity: string
          status: string
          suggested_action: string | null
          topic: string
          unique_searchers: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          impact_score?: number | null
          last_searched_at?: string | null
          metadata?: Json | null
          org_id: string
          related_concept_ids?: string[] | null
          resolved_at?: string | null
          resolved_by_content_id?: string | null
          search_count?: number | null
          severity?: string
          status?: string
          suggested_action?: string | null
          topic: string
          unique_searchers?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          impact_score?: number | null
          last_searched_at?: string | null
          metadata?: Json | null
          org_id?: string
          related_concept_ids?: string[] | null
          resolved_at?: string | null
          resolved_by_content_id?: string | null
          search_count?: number | null
          severity?: string
          status?: string
          suggested_action?: string | null
          topic?: string
          unique_searchers?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_gaps_resolved_by_content_id_fkey"
            columns: ["resolved_by_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_gaps_resolved_by_content_id_fkey"
            columns: ["resolved_by_content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      mcp_api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          permissions: string[] | null
          request_count: number | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          permissions?: string[] | null
          request_count?: number | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          permissions?: string[] | null
          request_count?: number | null
        }
        Relationships: []
      }
      member: {
        Row: {
          createdAt: string
          id: string
          organizationId: string
          role: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id: string
          organizationId: string
          role?: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          organizationId?: string
          role?: string
          userId?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          payload: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_agent_settings: {
        Row: {
          created_at: string | null
          curator_enabled: boolean | null
          digest_enabled: boolean | null
          gap_intelligence_enabled: boolean | null
          global_agent_enabled: boolean | null
          id: string
          metadata: Json | null
          onboarding_enabled: boolean | null
          org_id: string
          updated_at: string | null
          wiki_auto_publish: boolean
          wiki_cluster_context_enabled: boolean
          wiki_stale_threshold_days: number
          workflow_extraction_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          curator_enabled?: boolean | null
          digest_enabled?: boolean | null
          gap_intelligence_enabled?: boolean | null
          global_agent_enabled?: boolean | null
          id?: string
          metadata?: Json | null
          onboarding_enabled?: boolean | null
          org_id: string
          updated_at?: string | null
          wiki_auto_publish?: boolean
          wiki_cluster_context_enabled?: boolean
          wiki_stale_threshold_days?: number
          workflow_extraction_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          curator_enabled?: boolean | null
          digest_enabled?: boolean | null
          gap_intelligence_enabled?: boolean | null
          global_agent_enabled?: boolean | null
          id?: string
          metadata?: Json | null
          onboarding_enabled?: boolean | null
          org_id?: string
          updated_at?: string | null
          wiki_auto_publish?: boolean
          wiki_cluster_context_enabled?: boolean
          wiki_stale_threshold_days?: number
          workflow_extraction_enabled?: boolean | null
        }
        Relationships: []
      }
      org_publish_settings: {
        Row: {
          auto_publish_connector_id: string | null
          auto_publish_destination: string | null
          auto_publish_enabled: boolean
          auto_publish_folder_id: string | null
          auto_publish_folder_path: string | null
          created_at: string
          custom_footer_text: string | null
          custom_video_domain: string | null
          default_branding: Json | null
          default_format: Database["public"]["Enums"]["publish_format"]
          id: string
          org_id: string
          updated_at: string
          white_label_enabled: boolean
        }
        Insert: {
          auto_publish_connector_id?: string | null
          auto_publish_destination?: string | null
          auto_publish_enabled?: boolean
          auto_publish_folder_id?: string | null
          auto_publish_folder_path?: string | null
          created_at?: string
          custom_footer_text?: string | null
          custom_video_domain?: string | null
          default_branding?: Json | null
          default_format?: Database["public"]["Enums"]["publish_format"]
          id?: string
          org_id: string
          updated_at?: string
          white_label_enabled?: boolean
        }
        Update: {
          auto_publish_connector_id?: string | null
          auto_publish_destination?: string | null
          auto_publish_enabled?: boolean
          auto_publish_folder_id?: string | null
          auto_publish_folder_path?: string | null
          created_at?: string
          custom_footer_text?: string | null
          custom_video_domain?: string | null
          default_branding?: Json | null
          default_format?: Database["public"]["Enums"]["publish_format"]
          id?: string
          org_id?: string
          updated_at?: string
          white_label_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "org_publish_settings_auto_publish_connector_id_fkey"
            columns: ["auto_publish_connector_id"]
            isOneToOne: false
            referencedRelation: "connector_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_publish_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_quotas: {
        Row: {
          ai_requests_per_month: number
          ai_requests_used: number | null
          api_rate_limit: number
          connectors_allowed: number
          connectors_used: number | null
          created_at: string | null
          id: string
          org_id: string
          plan_tier: string
          quota_reset_at: string | null
          recordings_per_month: number
          recordings_used: number | null
          search_rate_limit: number
          searches_per_month: number
          searches_used: number | null
          storage_gb: number
          storage_used_gb: number | null
          updated_at: string | null
        }
        Insert: {
          ai_requests_per_month?: number
          ai_requests_used?: number | null
          api_rate_limit?: number
          connectors_allowed?: number
          connectors_used?: number | null
          created_at?: string | null
          id?: string
          org_id: string
          plan_tier?: string
          quota_reset_at?: string | null
          recordings_per_month?: number
          recordings_used?: number | null
          search_rate_limit?: number
          searches_per_month?: number
          searches_used?: number | null
          storage_gb?: number
          storage_used_gb?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_requests_per_month?: number
          ai_requests_used?: number | null
          api_rate_limit?: number
          connectors_allowed?: number
          connectors_used?: number | null
          created_at?: string | null
          id?: string
          org_id?: string
          plan_tier?: string
          quota_reset_at?: string | null
          recordings_per_month?: number
          recordings_used?: number | null
          search_rate_limit?: number
          searches_per_month?: number
          searches_used?: number | null
          storage_gb?: number
          storage_used_gb?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_quotas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_webhooks: {
        Row: {
          consecutive_failures: number | null
          created_at: string
          created_by: string
          description: string | null
          enabled: boolean | null
          events: string[] | null
          failed_deliveries: number | null
          headers: Json | null
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          last_triggered_at: string | null
          max_retries: number | null
          metadata: Json | null
          name: string
          org_id: string
          retry_enabled: boolean | null
          secret: string
          status: string
          successful_deliveries: number | null
          timeout_ms: number | null
          total_deliveries: number | null
          updated_at: string
          url: string
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          enabled?: boolean | null
          events?: string[] | null
          failed_deliveries?: number | null
          headers?: Json | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          last_triggered_at?: string | null
          max_retries?: number | null
          metadata?: Json | null
          name: string
          org_id: string
          retry_enabled?: boolean | null
          secret: string
          status?: string
          successful_deliveries?: number | null
          timeout_ms?: number | null
          total_deliveries?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          enabled?: boolean | null
          events?: string[] | null
          failed_deliveries?: number | null
          headers?: Json | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          last_triggered_at?: string | null
          max_retries?: number | null
          metadata?: Json | null
          name?: string
          org_id?: string
          retry_enabled?: boolean | null
          secret?: string
          status?: string
          successful_deliveries?: number | null
          timeout_ms?: number | null
          total_deliveries?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_wiki_pages: {
        Row: {
          app: string | null
          cluster_id: string | null
          compilation_log: Json
          confidence: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          org_id: string
          screen: string | null
          supersedes_id: string | null
          topic: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          app?: string | null
          cluster_id?: string | null
          compilation_log?: Json
          confidence?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          org_id: string
          screen?: string | null
          supersedes_id?: string | null
          topic: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          app?: string | null
          cluster_id?: string | null
          compilation_log?: Json
          confidence?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          org_id?: string
          screen?: string | null
          supersedes_id?: string | null
          topic?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_wiki_pages_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "wiki_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_wiki_pages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_wiki_pages_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "active_org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_wiki_pages_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "org_wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      organization: {
        Row: {
          createdAt: string
          id: string
          logo: string | null
          metadata: string | null
          name: string
          slug: string | null
        }
        Insert: {
          createdAt?: string
          id: string
          logo?: string | null
          metadata?: string | null
          name: string
          slug?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          logo?: string | null
          metadata?: string | null
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          billing_email: string | null
          clerk_org_id: string | null
          created_at: string
          deleted_at: string | null
          domain: string | null
          features: Json | null
          id: string
          logo_url: string | null
          max_storage_gb: number | null
          max_users: number | null
          metadata: string | null
          name: string
          onboarded_at: string | null
          plan: string
          primary_color: string | null
          settings: Json | null
          slug: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
          vendor_org_id: string | null
        }
        Insert: {
          billing_email?: string | null
          clerk_org_id?: string | null
          created_at?: string
          deleted_at?: string | null
          domain?: string | null
          features?: Json | null
          id?: string
          logo_url?: string | null
          max_storage_gb?: number | null
          max_users?: number | null
          metadata?: string | null
          name: string
          onboarded_at?: string | null
          plan?: string
          primary_color?: string | null
          settings?: Json | null
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          vendor_org_id?: string | null
        }
        Update: {
          billing_email?: string | null
          clerk_org_id?: string | null
          created_at?: string
          deleted_at?: string | null
          domain?: string | null
          features?: Json | null
          id?: string
          logo_url?: string | null
          max_storage_gb?: number | null
          max_users?: number | null
          metadata?: string | null
          name?: string
          onboarded_at?: string | null
          plan?: string
          primary_color?: string | null
          settings?: Json | null
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          vendor_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_logs: {
        Row: {
          action: Database["public"]["Enums"]["publish_action"]
          api_calls_made: number | null
          completed_at: string | null
          content_id: string
          content_size_bytes: number | null
          created_at: string
          destination: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          id: string
          org_id: string
          published_document_id: string | null
          request_metadata: Json | null
          result_metadata: Json | null
          status: string
          trigger_type: Database["public"]["Enums"]["publish_trigger"]
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["publish_action"]
          api_calls_made?: number | null
          completed_at?: string | null
          content_id: string
          content_size_bytes?: number | null
          created_at?: string
          destination: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          published_document_id?: string | null
          request_metadata?: Json | null
          result_metadata?: Json | null
          status?: string
          trigger_type?: Database["public"]["Enums"]["publish_trigger"]
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["publish_action"]
          api_calls_made?: number | null
          completed_at?: string | null
          content_id?: string
          content_size_bytes?: number | null
          created_at?: string
          destination?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          published_document_id?: string | null
          request_metadata?: Json | null
          result_metadata?: Json | null
          status?: string
          trigger_type?: Database["public"]["Enums"]["publish_trigger"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publish_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "publish_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_logs_published_document_id_fkey"
            columns: ["published_document_id"]
            isOneToOne: false
            referencedRelation: "published_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      published_documents: {
        Row: {
          branding_config: Json | null
          connector_id: string
          content_hash: string | null
          content_id: string
          created_at: string
          custom_title: string | null
          deleted_at: string | null
          destination: string
          document_id: string
          document_version: number
          external_id: string
          external_path: string | null
          external_url: string
          external_version: string | null
          folder_id: string | null
          folder_path: string | null
          format: Database["public"]["Enums"]["publish_format"]
          id: string
          last_error: string | null
          last_published_at: string | null
          last_synced_at: string | null
          org_id: string
          published_by: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
        }
        Insert: {
          branding_config?: Json | null
          connector_id: string
          content_hash?: string | null
          content_id: string
          created_at?: string
          custom_title?: string | null
          deleted_at?: string | null
          destination: string
          document_id: string
          document_version?: number
          external_id: string
          external_path?: string | null
          external_url: string
          external_version?: string | null
          folder_id?: string | null
          folder_path?: string | null
          format?: Database["public"]["Enums"]["publish_format"]
          id?: string
          last_error?: string | null
          last_published_at?: string | null
          last_synced_at?: string | null
          org_id: string
          published_by?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Update: {
          branding_config?: Json | null
          connector_id?: string
          content_hash?: string | null
          content_id?: string
          created_at?: string
          custom_title?: string | null
          deleted_at?: string | null
          destination?: string
          document_id?: string
          document_version?: number
          external_id?: string
          external_path?: string | null
          external_url?: string
          external_version?: string | null
          folder_id?: string | null
          folder_path?: string | null
          format?: Database["public"]["Enums"]["publish_format"]
          id?: string
          last_error?: string | null
          last_published_at?: string | null
          last_synced_at?: string | null
          org_id?: string
          published_by?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_documents_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_documents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_documents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "published_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_documents_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      query_cache: {
        Row: {
          created_at: string | null
          filters: Json | null
          hit_count: number | null
          id: string
          last_accessed_at: string | null
          org_id: string | null
          query_embedding: string | null
          query_hash: string
          query_text: string
          results: Json
          ttl: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          org_id?: string | null
          query_embedding?: string | null
          query_hash: string
          query_text: string
          results: Json
          ttl: string
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          org_id?: string | null
          query_embedding?: string | null
          query_hash?: string
          query_text?: string
          results?: Json
          ttl?: string
        }
        Relationships: [
          {
            foreignKeyName: "query_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quota_usage_events: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          quota_type: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          quota_type: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          quota_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quota_usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          actual_savings: number | null
          completed_at: string | null
          created_at: string | null
          description: string
          effort: string
          estimated_completion: string | null
          id: string
          impact: string
          implementation: string
          implementation_days: number | null
          organization_id: string
          progress: number | null
          savings: number
          started_at: string | null
          status: string
          timeframe: string
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_savings?: number | null
          completed_at?: string | null
          created_at?: string | null
          description: string
          effort: string
          estimated_completion?: string | null
          id?: string
          impact: string
          implementation: string
          implementation_days?: number | null
          organization_id: string
          progress?: number | null
          savings?: number
          started_at?: string | null
          status?: string
          timeframe: string
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_savings?: number | null
          completed_at?: string | null
          created_at?: string | null
          description?: string
          effort?: string
          estimated_completion?: string | null
          id?: string
          impact?: string
          implementation?: string
          implementation_days?: number | null
          organization_id?: string
          progress?: number | null
          savings?: number
          started_at?: string | null
          status?: string
          timeframe?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      result_annotations: {
        Row: {
          annotation: string
          created_at: string | null
          id: string
          is_shared: boolean | null
          org_id: string
          result_id: string
          result_type: string
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annotation: string
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          org_id: string
          result_id: string
          result_type: string
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annotation?: string
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          org_id?: string
          result_id?: string
          result_type?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_annotations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_annotations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          last_run_at: string | null
          name: string
          notification_enabled: boolean | null
          org_id: string
          query: string
          run_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          last_run_at?: string | null
          name: string
          notification_enabled?: boolean | null
          org_id: string
          query: string
          run_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          last_run_at?: string | null
          name?: string
          notification_enabled?: boolean | null
          org_id?: string
          query?: string
          run_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      search_analytics: {
        Row: {
          cache_hit: boolean | null
          cache_layer: string | null
          clicked_result_ids: string[] | null
          created_at: string
          filters: Json | null
          id: string
          latency_ms: number | null
          mode: string | null
          org_id: string
          query: string
          results_count: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id: string
          query: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id?: string
          query?: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      search_analytics_2025_10: {
        Row: {
          cache_hit: boolean | null
          cache_layer: string | null
          clicked_result_ids: string[] | null
          created_at: string
          filters: Json | null
          id: string
          latency_ms: number | null
          mode: string | null
          org_id: string
          query: string
          results_count: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id: string
          query: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id?: string
          query?: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_analytics_2025_11: {
        Row: {
          cache_hit: boolean | null
          cache_layer: string | null
          clicked_result_ids: string[] | null
          created_at: string
          filters: Json | null
          id: string
          latency_ms: number | null
          mode: string | null
          org_id: string
          query: string
          results_count: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id: string
          query: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id?: string
          query?: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_analytics_2025_12: {
        Row: {
          cache_hit: boolean | null
          cache_layer: string | null
          clicked_result_ids: string[] | null
          created_at: string
          filters: Json | null
          id: string
          latency_ms: number | null
          mode: string | null
          org_id: string
          query: string
          results_count: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id: string
          query: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id?: string
          query?: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_analytics_2026_01: {
        Row: {
          cache_hit: boolean | null
          cache_layer: string | null
          clicked_result_ids: string[] | null
          created_at: string
          filters: Json | null
          id: string
          latency_ms: number | null
          mode: string | null
          org_id: string
          query: string
          results_count: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id: string
          query: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          cache_layer?: string | null
          clicked_result_ids?: string[] | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          mode?: string | null
          org_id?: string
          query?: string
          results_count?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          dwell_time_ms: number | null
          feedback_type: string
          id: string
          metadata: Json | null
          org_id: string
          position: number | null
          query: string
          result_id: string
          result_type: string | null
          time_to_click_ms: number | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          dwell_time_ms?: number | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          position?: number | null
          query: string
          result_id: string
          result_type?: string | null
          time_to_click_ms?: number | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          dwell_time_ms?: number | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          position?: number | null
          query?: string
          result_id?: string
          result_type?: string | null
          time_to_click_ms?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          created_at: string | null
          expires_at: string | null
          filters: Json | null
          id: string
          org_id: string
          query: string
          results_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          filters?: Json | null
          id?: string
          org_id: string
          query: string
          results_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          filters?: Json | null
          id?: string
          org_id?: string
          query?: string
          results_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      search_metrics_archive: {
        Row: {
          avg_similarity: number | null
          created_at: string
          embedding_time_ms: number | null
          id: string
          max_similarity: number | null
          min_similarity: number | null
          org_id: string
          query_id: string
          query_length: number
          query_text: string
          query_word_count: number
          retried_with_hybrid: boolean | null
          retried_with_keyword: boolean | null
          retried_with_lower_threshold: boolean | null
          retrieval_attempts: number | null
          search_time_ms: number | null
          search_timestamp: string
          similarity_threshold: number | null
          sources_found: number
          strategy: string | null
          success: boolean
          total_time_ms: number
          use_agentic: boolean | null
          use_hybrid: boolean | null
          used_tool_fallback: boolean | null
          user_id: string | null
        }
        Insert: {
          avg_similarity?: number | null
          created_at?: string
          embedding_time_ms?: number | null
          id?: string
          max_similarity?: number | null
          min_similarity?: number | null
          org_id: string
          query_id: string
          query_length: number
          query_text: string
          query_word_count: number
          retried_with_hybrid?: boolean | null
          retried_with_keyword?: boolean | null
          retried_with_lower_threshold?: boolean | null
          retrieval_attempts?: number | null
          search_time_ms?: number | null
          search_timestamp: string
          similarity_threshold?: number | null
          sources_found?: number
          strategy?: string | null
          success?: boolean
          total_time_ms: number
          use_agentic?: boolean | null
          use_hybrid?: boolean | null
          used_tool_fallback?: boolean | null
          user_id?: string | null
        }
        Update: {
          avg_similarity?: number | null
          created_at?: string
          embedding_time_ms?: number | null
          id?: string
          max_similarity?: number | null
          min_similarity?: number | null
          org_id?: string
          query_id?: string
          query_length?: number
          query_text?: string
          query_word_count?: number
          retried_with_hybrid?: boolean | null
          retried_with_keyword?: boolean | null
          retried_with_lower_threshold?: boolean | null
          retrieval_attempts?: number | null
          search_time_ms?: number | null
          search_timestamp?: string
          similarity_threshold?: number | null
          sources_found?: number
          strategy?: string | null
          success?: boolean
          total_time_ms?: number
          use_agentic?: boolean | null
          use_hybrid?: boolean | null
          used_tool_fallback?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_metrics_archive_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_metrics_archive_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          org_id: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          org_id?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          org_id?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_transcripts: {
        Row: {
          audio_transcript: Json
          combined_narrative: string | null
          content_id: string
          created_at: string
          embeddings_generated: boolean | null
          error_message: string | null
          id: string
          key_moments: Json
          key_moments_count: number | null
          parent_job_id: string | null
          processed_at: string
          segment_duration: number
          segment_index: number
          segment_start_time: number
          status: Database["public"]["Enums"]["segment_status"] | null
          visual_events: Json
        }
        Insert: {
          audio_transcript?: Json
          combined_narrative?: string | null
          content_id: string
          created_at?: string
          embeddings_generated?: boolean | null
          error_message?: string | null
          id?: string
          key_moments?: Json
          key_moments_count?: number | null
          parent_job_id?: string | null
          processed_at?: string
          segment_duration: number
          segment_index: number
          segment_start_time: number
          status?: Database["public"]["Enums"]["segment_status"] | null
          visual_events?: Json
        }
        Update: {
          audio_transcript?: Json
          combined_narrative?: string | null
          content_id?: string
          created_at?: string
          embeddings_generated?: boolean | null
          error_message?: string | null
          id?: string
          key_moments?: Json
          key_moments_count?: number | null
          parent_job_id?: string | null
          processed_at?: string
          segment_duration?: number
          segment_index?: number
          segment_start_time?: number
          status?: Database["public"]["Enums"]["segment_status"] | null
          visual_events?: Json
        }
        Relationships: [
          {
            foreignKeyName: "segment_transcripts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_transcripts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "segment_transcripts_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          activeOrganizationId: string | null
          createdAt: string
          expiresAt: string
          id: string
          impersonatedBy: string | null
          ipAddress: string | null
          token: string
          updatedAt: string
          userAgent: string | null
          userId: string
        }
        Insert: {
          activeOrganizationId?: string | null
          createdAt?: string
          expiresAt: string
          id: string
          impersonatedBy?: string | null
          ipAddress?: string | null
          token: string
          updatedAt?: string
          userAgent?: string | null
          userId: string
        }
        Update: {
          activeOrganizationId?: string | null
          createdAt?: string
          expiresAt?: string
          id?: string
          impersonatedBy?: string | null
          ipAddress?: string | null
          token?: string
          updatedAt?: string
          userAgent?: string | null
          userId?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          access_count: number | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          org_id: string
          password_hash: string | null
          revoked_at: string | null
          share_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          access_count?: number | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          org_id: string
          password_hash?: string | null
          revoked_at?: string | null
          share_id?: string
          target_id: string
          target_type: string
        }
        Update: {
          access_count?: number | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          org_id?: string
          password_hash?: string | null
          revoked_at?: string | null
          share_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      similarity_matches: {
        Row: {
          audio_similarity: number
          content_id: string
          detected_at: string | null
          hamming_distance: number
          id: string
          overall_similarity: number
          similar_content_id: string
          video_similarity: number
        }
        Insert: {
          audio_similarity: number
          content_id: string
          detected_at?: string | null
          hamming_distance: number
          id?: string
          overall_similarity: number
          similar_content_id: string
          video_similarity: number
        }
        Update: {
          audio_similarity?: number
          content_id?: string
          detected_at?: string | null
          hamming_distance?: number
          id?: string
          overall_similarity?: number
          similar_content_id?: string
          video_similarity?: number
        }
        Relationships: [
          {
            foreignKeyName: "similarity_matches_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "similarity_matches_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "similarity_matches_similar_content_id_fkey"
            columns: ["similar_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "similarity_matches_similar_content_id_fkey"
            columns: ["similar_content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      storage_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          current_value: number
          description: string
          deviation_percentage: number | null
          expected_value: number | null
          id: string
          metric_name: string
          org_id: string
          recommendation: string | null
          resolved_at: string | null
          severity: string
          status: string
          threshold_value: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          current_value: number
          description: string
          deviation_percentage?: number | null
          expected_value?: number | null
          id?: string
          metric_name: string
          org_id: string
          recommendation?: string | null
          resolved_at?: string | null
          severity: string
          status?: string
          threshold_value?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          current_value?: number
          description?: string
          deviation_percentage?: number | null
          expected_value?: number | null
          id?: string
          metric_name?: string
          org_id?: string
          recommendation?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          threshold_value?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_history: {
        Row: {
          compressed_files: number
          cost_estimate: number
          created_at: string | null
          date: string
          deduplicated_files: number
          failed_jobs: number
          files_added: number
          files_deleted: number
          id: string
          net_growth_bytes: number
          optimization_percentage: number
          org_id: string
          pending_jobs: number
          provider_breakdown: Json
          space_saved_bytes: number
          tier_breakdown: Json
          total_files: number
          total_storage_bytes: number
        }
        Insert: {
          compressed_files?: number
          cost_estimate?: number
          created_at?: string | null
          date: string
          deduplicated_files?: number
          failed_jobs?: number
          files_added?: number
          files_deleted?: number
          id?: string
          net_growth_bytes?: number
          optimization_percentage?: number
          org_id: string
          pending_jobs?: number
          provider_breakdown?: Json
          space_saved_bytes?: number
          tier_breakdown?: Json
          total_files?: number
          total_storage_bytes?: number
        }
        Update: {
          compressed_files?: number
          cost_estimate?: number
          created_at?: string | null
          date?: string
          deduplicated_files?: number
          failed_jobs?: number
          files_added?: number
          files_deleted?: number
          id?: string
          net_growth_bytes?: number
          optimization_percentage?: number
          org_id?: string
          pending_jobs?: number
          provider_breakdown?: Json
          space_saved_bytes?: number
          tier_breakdown?: Json
          total_files?: number
          total_storage_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "storage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_metrics: {
        Row: {
          cold_storage: number
          compression_rate: number | null
          created_at: string | null
          deduplication_savings: number
          glacier_storage: number
          hot_storage: number
          id: string
          organization_id: string
          processing_cost: number
          recorded_at: string
          storage_cost: number
          total_cost: number
          total_files: number
          total_recordings: number
          total_storage: number
          total_users: number
          updated_at: string | null
          warm_storage: number
        }
        Insert: {
          cold_storage?: number
          compression_rate?: number | null
          created_at?: string | null
          deduplication_savings?: number
          glacier_storage?: number
          hot_storage?: number
          id?: string
          organization_id: string
          processing_cost?: number
          recorded_at: string
          storage_cost?: number
          total_cost?: number
          total_files?: number
          total_recordings?: number
          total_storage?: number
          total_users?: number
          updated_at?: string | null
          warm_storage?: number
        }
        Update: {
          cold_storage?: number
          compression_rate?: number | null
          created_at?: string | null
          deduplication_savings?: number
          glacier_storage?: number
          hot_storage?: number
          id?: string
          organization_id?: string
          processing_cost?: number
          recorded_at?: string
          storage_cost?: number
          total_cost?: number
          total_files?: number
          total_recordings?: number
          total_storage?: number
          total_users?: number
          updated_at?: string | null
          warm_storage?: number
        }
        Relationships: [
          {
            foreignKeyName: "storage_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_migrations: {
        Row: {
          completed_at: string | null
          content_id: string
          created_at: string | null
          error: string | null
          file_size: number
          from_provider: Database["public"]["Enums"]["storage_provider"]
          from_tier: Database["public"]["Enums"]["storage_tier"]
          id: string
          org_id: string
          started_at: string | null
          status: string
          to_provider: Database["public"]["Enums"]["storage_provider"]
          to_tier: Database["public"]["Enums"]["storage_tier"]
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          created_at?: string | null
          error?: string | null
          file_size: number
          from_provider: Database["public"]["Enums"]["storage_provider"]
          from_tier: Database["public"]["Enums"]["storage_tier"]
          id?: string
          org_id: string
          started_at?: string | null
          status?: string
          to_provider: Database["public"]["Enums"]["storage_provider"]
          to_tier: Database["public"]["Enums"]["storage_tier"]
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          created_at?: string | null
          error?: string | null
          file_size?: number
          from_provider?: Database["public"]["Enums"]["storage_provider"]
          from_tier?: Database["public"]["Enums"]["storage_tier"]
          id?: string
          org_id?: string
          started_at?: string | null
          status?: string
          to_provider?: Database["public"]["Enums"]["storage_provider"]
          to_tier?: Database["public"]["Enums"]["storage_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "storage_migrations_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_migrations_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "storage_migrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_log: {
        Row: {
          api_health: number
          api_response_time: number
          created_at: string | null
          database_health: number
          id: string
          job_processing_time: number
          jobs_health: number
          overall_score: number
          recorded_at: string
          storage_health: number
          storage_latency: number
          throughput: number
        }
        Insert: {
          api_health: number
          api_response_time?: number
          created_at?: string | null
          database_health: number
          id?: string
          job_processing_time?: number
          jobs_health: number
          overall_score: number
          recorded_at: string
          storage_health: number
          storage_latency?: number
          throughput?: number
        }
        Update: {
          api_health?: number
          api_response_time?: number
          created_at?: string | null
          database_health?: number
          id?: string
          job_processing_time?: number
          jobs_health?: number
          overall_score?: number
          recorded_at?: string
          storage_health?: number
          storage_latency?: number
          throughput?: number
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          id: string
          labels: Json | null
          metric_name: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          id?: string
          labels?: Json | null
          metric_name: string
          metric_value: number
          recorded_at?: string
        }
        Update: {
          id?: string
          labels?: Json | null
          metric_name?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_chunks: {
        Row: {
          boundary_type: string | null
          chunk_index: number
          chunk_text: string
          chunking_strategy: string | null
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"] | null
          created_at: string
          embedding: string | null
          end_time_sec: number | null
          id: string
          metadata: Json | null
          model: string | null
          org_id: string
          segment_index: number | null
          semantic_score: number | null
          start_time_sec: number | null
          structure_type: string | null
        }
        Insert: {
          boundary_type?: string | null
          chunk_index: number
          chunk_text: string
          chunking_strategy?: string | null
          content_id: string
          content_type?: Database["public"]["Enums"]["content_type"] | null
          created_at?: string
          embedding?: string | null
          end_time_sec?: number | null
          id?: string
          metadata?: Json | null
          model?: string | null
          org_id: string
          segment_index?: number | null
          semantic_score?: number | null
          start_time_sec?: number | null
          structure_type?: string | null
        }
        Update: {
          boundary_type?: string | null
          chunk_index?: number
          chunk_text?: string
          chunking_strategy?: string | null
          content_id?: string
          content_type?: Database["public"]["Enums"]["content_type"] | null
          created_at?: string
          embedding?: string | null
          end_time_sec?: number | null
          id?: string
          metadata?: Json | null
          model?: string | null
          org_id?: string
          segment_index?: number | null
          semantic_score?: number | null
          start_time_sec?: number | null
          structure_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcript_chunks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_chunks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "transcript_chunks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          confidence: number | null
          content_id: string
          created_at: string
          id: string
          language: string | null
          provider: string | null
          provider_job_id: string | null
          superseded: boolean | null
          text: string
          updated_at: string
          video_metadata: Json | null
          visual_events: Json | null
          words_json: Json | null
        }
        Insert: {
          confidence?: number | null
          content_id: string
          created_at?: string
          id?: string
          language?: string | null
          provider?: string | null
          provider_job_id?: string | null
          superseded?: boolean | null
          text: string
          updated_at?: string
          video_metadata?: Json | null
          visual_events?: Json | null
          words_json?: Json | null
        }
        Update: {
          confidence?: number | null
          content_id?: string
          created_at?: string
          id?: string
          language?: string | null
          provider?: string | null
          provider_job_id?: string | null
          superseded?: boolean | null
          text?: string
          updated_at?: string
          video_metadata?: Json | null
          visual_events?: Json | null
          words_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          minutes_transcribed: number | null
          org_id: string
          period: string
          queries_count: number | null
          recordings_count: number | null
          storage_gb: number | null
          tokens_in: number | null
          tokens_out: number | null
          updated_at: string
        }
        Insert: {
          minutes_transcribed?: number | null
          org_id: string
          period?: string
          queries_count?: number | null
          recordings_count?: number | null
          storage_gb?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          updated_at?: string
        }
        Update: {
          minutes_transcribed?: number | null
          org_id?: string
          period?: string
          queries_count?: number | null
          recordings_count?: number | null
          storage_gb?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user: {
        Row: {
          avatar_url: string | null
          banExpires: string | null
          banned: boolean | null
          banReason: string | null
          createdAt: string
          email: string
          emailVerified: boolean
          id: string
          image: string | null
          name: string
          phone: string | null
          role: string | null
          timezone: string | null
          title: string | null
          updatedAt: string
        }
        Insert: {
          avatar_url?: string | null
          banExpires?: string | null
          banned?: boolean | null
          banReason?: string | null
          createdAt?: string
          email: string
          emailVerified?: boolean
          id: string
          image?: string | null
          name: string
          phone?: string | null
          role?: string | null
          timezone?: string | null
          title?: string | null
          updatedAt?: string
        }
        Update: {
          avatar_url?: string | null
          banExpires?: string | null
          banned?: boolean | null
          banReason?: string | null
          createdAt?: string
          email?: string
          emailVerified?: boolean
          id?: string
          image?: string | null
          name?: string
          phone?: string | null
          role?: string | null
          timezone?: string | null
          title?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      user_departments: {
        Row: {
          created_at: string
          department_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          custom_message: string | null
          department_ids: string[] | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          metadata: Json | null
          org_id: string
          reminder_count: number | null
          reminder_sent_at: string | null
          revoked_at: string | null
          role: string
          sent_at: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          custom_message?: string | null
          department_ids?: string[] | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          metadata?: Json | null
          org_id: string
          reminder_count?: number | null
          reminder_sent_at?: string | null
          revoked_at?: string | null
          role: string
          sent_at?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          custom_message?: string | null
          department_ids?: string[] | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          metadata?: Json | null
          org_id?: string
          reminder_count?: number | null
          reminder_sent_at?: string | null
          revoked_at?: string | null
          role?: string
          sent_at?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          clerk_session_id: string | null
          created_at: string
          device_type: string | null
          expires_at: string
          id: string
          ip_address: unknown
          last_active_at: string
          location: Json | null
          org_id: string
          os: string | null
          revoked_at: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          clerk_session_id?: string | null
          created_at?: string
          device_type?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          last_active_at?: string
          location?: Json | null
          org_id: string
          os?: string | null
          revoked_at?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          clerk_session_id?: string | null
          created_at?: string
          device_type?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          last_active_at?: string
          location?: Json | null
          org_id?: string
          os?: string | null
          revoked_at?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wiki_interactions: {
        Row: {
          created_at: string
          id: string
          interaction_type: string
          org_id: string
          user_id: string
          wiki_page_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type: string
          org_id: string
          user_id: string
          wiki_page_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string
          org_id?: string
          user_id?: string
          wiki_page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wiki_interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_wiki_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_wiki_interactions_wiki_page_id_fkey"
            columns: ["wiki_page_id"]
            isOneToOne: false
            referencedRelation: "active_org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_wiki_interactions_wiki_page_id_fkey"
            columns: ["wiki_page_id"]
            isOneToOne: false
            referencedRelation: "org_wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          ban_expires: string | null
          ban_reason: string | null
          banned: boolean | null
          bio: string | null
          clerk_id: string | null
          created_at: string
          deleted_at: string | null
          department_id: string | null
          email: string
          email_verified: boolean | null
          id: string
          invitation_expires_at: string | null
          invitation_token: string | null
          invited_by: string | null
          is_system_admin: boolean | null
          last_active_at: string | null
          last_login_at: string | null
          login_count: number | null
          name: string | null
          notification_preferences: Json | null
          onboarded_at: string | null
          org_id: string
          phone: string | null
          role: string | null
          status: string | null
          timezone: string | null
          title: string | null
          ui_preferences: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          ban_expires?: string | null
          ban_reason?: string | null
          banned?: boolean | null
          bio?: string | null
          clerk_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          email: string
          email_verified?: boolean | null
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_by?: string | null
          is_system_admin?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          login_count?: number | null
          name?: string | null
          notification_preferences?: Json | null
          onboarded_at?: string | null
          org_id: string
          phone?: string | null
          role?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          ui_preferences?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          ban_expires?: string | null
          ban_reason?: string | null
          banned?: boolean | null
          bio?: string | null
          clerk_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          email?: string
          email_verified?: boolean | null
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_by?: string | null
          is_system_admin?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          login_count?: number | null
          name?: string | null
          notification_preferences?: Json | null
          onboarded_at?: string | null
          org_id?: string
          phone?: string | null
          role?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          ui_preferences?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_rpm: number | null
          revoked_at: string | null
          scopes: string[] | null
          vendor_org_id: string
          white_label_config_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit_rpm?: number | null
          revoked_at?: string | null
          scopes?: string[] | null
          vendor_org_id: string
          white_label_config_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_rpm?: number | null
          revoked_at?: string | null
          scopes?: string[] | null
          vendor_org_id?: string
          white_label_config_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_api_keys_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_api_keys_white_label_config_id_fkey"
            columns: ["white_label_config_id"]
            isOneToOne: false
            referencedRelation: "white_label_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_doc_sources: {
        Row: {
          app: string
          applicability: Json
          content_hash: string | null
          created_at: string
          fetch_strategy: Database["public"]["Enums"]["vendor_fetch_strategy"]
          freshness_target: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_success_at: string | null
          official_source: boolean
          plan_band: string[]
          publisher_hostname: string
          source_kind: Database["public"]["Enums"]["vendor_source_kind"]
          source_url: string
          terms_review_status: Database["public"]["Enums"]["vendor_terms_review_status"]
          updated_at: string
          version_band: string[]
        }
        Insert: {
          app: string
          applicability?: Json
          content_hash?: string | null
          created_at?: string
          fetch_strategy: Database["public"]["Enums"]["vendor_fetch_strategy"]
          freshness_target?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          official_source?: boolean
          plan_band?: string[]
          publisher_hostname: string
          source_kind: Database["public"]["Enums"]["vendor_source_kind"]
          source_url: string
          terms_review_status?: Database["public"]["Enums"]["vendor_terms_review_status"]
          updated_at?: string
          version_band?: string[]
        }
        Update: {
          app?: string
          applicability?: Json
          content_hash?: string | null
          created_at?: string
          fetch_strategy?: Database["public"]["Enums"]["vendor_fetch_strategy"]
          freshness_target?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          official_source?: boolean
          plan_band?: string[]
          publisher_hostname?: string
          source_kind?: Database["public"]["Enums"]["vendor_source_kind"]
          source_url?: string
          terms_review_status?: Database["public"]["Enums"]["vendor_terms_review_status"]
          updated_at?: string
          version_band?: string[]
        }
        Relationships: []
      }
      vendor_usage_events: {
        Row: {
          api_key_id: string | null
          app: string | null
          created_at: string
          customer_org_id: string | null
          event_type: string
          had_org_knowledge: boolean | null
          had_vendor_knowledge: boolean | null
          id: string
          question: string | null
          response_latency_ms: number | null
          satisfaction_score: number | null
          screen: string | null
          vendor_org_id: string
        }
        Insert: {
          api_key_id?: string | null
          app?: string | null
          created_at?: string
          customer_org_id?: string | null
          event_type: string
          had_org_knowledge?: boolean | null
          had_vendor_knowledge?: boolean | null
          id?: string
          question?: string | null
          response_latency_ms?: number | null
          satisfaction_score?: number | null
          screen?: string | null
          vendor_org_id: string
        }
        Update: {
          api_key_id?: string | null
          app?: string | null
          created_at?: string
          customer_org_id?: string | null
          event_type?: string
          had_org_knowledge?: boolean | null
          had_vendor_knowledge?: boolean | null
          id?: string
          question?: string | null
          response_latency_ms?: number | null
          satisfaction_score?: number | null
          screen?: string | null
          vendor_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_usage_events_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "vendor_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_usage_events_customer_org_id_fkey"
            columns: ["customer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_usage_events_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_wiki_pages: {
        Row: {
          app: string
          app_version: string | null
          content: string
          content_hash: string | null
          created_at: string | null
          curated_by: string | null
          element_selectors: Json | null
          id: string
          ingest_job_id: string | null
          screen: string
          source_url: string | null
          updated_at: string | null
          vendor_source_id: string | null
        }
        Insert: {
          app: string
          app_version?: string | null
          content: string
          content_hash?: string | null
          created_at?: string | null
          curated_by?: string | null
          element_selectors?: Json | null
          id?: string
          ingest_job_id?: string | null
          screen: string
          source_url?: string | null
          updated_at?: string | null
          vendor_source_id?: string | null
        }
        Update: {
          app?: string
          app_version?: string | null
          content?: string
          content_hash?: string | null
          created_at?: string | null
          curated_by?: string | null
          element_selectors?: Json | null
          id?: string
          ingest_job_id?: string | null
          screen?: string
          source_url?: string | null
          updated_at?: string | null
          vendor_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_wiki_pages_curated_by_fkey"
            columns: ["curated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_wiki_pages_ingest_job_id_fkey"
            columns: ["ingest_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_wiki_pages_vendor_source_id_fkey"
            columns: ["vendor_source_id"]
            isOneToOne: false
            referencedRelation: "vendor_doc_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      verification: {
        Row: {
          createdAt: string | null
          expiresAt: string
          id: string
          identifier: string
          updatedAt: string | null
          value: string
        }
        Insert: {
          createdAt?: string | null
          expiresAt: string
          id: string
          identifier: string
          updatedAt?: string | null
          value: string
        }
        Update: {
          createdAt?: string | null
          expiresAt?: string
          id?: string
          identifier?: string
          updatedAt?: string | null
          value?: string
        }
        Relationships: []
      }
      video_frames: {
        Row: {
          content_id: string
          created_at: string | null
          detected_elements: Json | null
          frame_number: number | null
          frame_time_sec: number
          frame_url: string | null
          id: string
          metadata: Json | null
          ocr_blocks: Json | null
          ocr_confidence: number | null
          ocr_text: string | null
          org_id: string
          processed_at: string | null
          scene_type: string | null
          visual_description: string | null
          visual_embedding: string | null
        }
        Insert: {
          content_id: string
          created_at?: string | null
          detected_elements?: Json | null
          frame_number?: number | null
          frame_time_sec: number
          frame_url?: string | null
          id?: string
          metadata?: Json | null
          ocr_blocks?: Json | null
          ocr_confidence?: number | null
          ocr_text?: string | null
          org_id: string
          processed_at?: string | null
          scene_type?: string | null
          visual_description?: string | null
          visual_embedding?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string | null
          detected_elements?: Json | null
          frame_number?: number | null
          frame_time_sec?: number
          frame_url?: string | null
          id?: string
          metadata?: Json | null
          ocr_blocks?: Json | null
          ocr_confidence?: number | null
          ocr_text?: string | null
          org_id?: string
          processed_at?: string | null
          scene_type?: string | null
          visual_description?: string | null
          visual_embedding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_frames_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_frames_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "video_frames_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_number: number | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          next_retry_at: string | null
          org_id: string
          payload: Json
          response_body: string | null
          response_headers: Json | null
          response_status_code: number | null
          sent_at: string | null
          status: string
          webhook_id: string
        }
        Insert: {
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          next_retry_at?: string | null
          org_id: string
          payload: Json
          response_body?: string | null
          response_headers?: Json | null
          response_status_code?: number | null
          sent_at?: string | null
          status: string
          webhook_id: string
        }
        Update: {
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          next_retry_at?: string | null
          org_id?: string
          payload?: Json
          response_body?: string | null
          response_headers?: Json | null
          response_status_code?: number | null
          sent_at?: string | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "org_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          metadata: Json | null
          processed_at: string
          source: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          metadata?: Json | null
          processed_at?: string
          source: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          metadata?: Json | null
          processed_at?: string
          source?: string
        }
        Relationships: []
      }
      white_label_configs: {
        Row: {
          branding: Json
          created_at: string
          custom_domain: string | null
          domain_verification_token: string | null
          domain_verified: boolean
          domain_verified_at: string | null
          id: string
          is_active: boolean
          knowledge_scope: string[] | null
          updated_at: string
          vendor_org_id: string
          voice_config: Json
        }
        Insert: {
          branding?: Json
          created_at?: string
          custom_domain?: string | null
          domain_verification_token?: string | null
          domain_verified?: boolean
          domain_verified_at?: string | null
          id?: string
          is_active?: boolean
          knowledge_scope?: string[] | null
          updated_at?: string
          vendor_org_id: string
          voice_config?: Json
        }
        Update: {
          branding?: Json
          created_at?: string
          custom_domain?: string | null
          domain_verification_token?: string | null
          domain_verified?: boolean
          domain_verified_at?: string | null
          id?: string
          is_active?: boolean
          knowledge_scope?: string[] | null
          updated_at?: string
          vendor_org_id?: string
          voice_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "white_label_configs_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_clusters: {
        Row: {
          central_page_id: string | null
          computed_at: string
          id: string
          member_count: number
          modularity: number | null
          name: string
          org_id: string
        }
        Insert: {
          central_page_id?: string | null
          computed_at?: string
          id?: string
          member_count?: number
          modularity?: number | null
          name: string
          org_id: string
        }
        Update: {
          central_page_id?: string | null
          computed_at?: string
          id?: string
          member_count?: number
          modularity?: number | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_clusters_central_page_id_fkey"
            columns: ["central_page_id"]
            isOneToOne: false
            referencedRelation: "active_org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_clusters_central_page_id_fkey"
            columns: ["central_page_id"]
            isOneToOne: false
            referencedRelation: "org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_clusters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_lint_results: {
        Row: {
          confidence_decay_count: number
          coverage_gap_count: number
          details: Json
          id: string
          org_id: string
          orphan_count: number
          run_at: string
          run_day: string | null
          stale_count: number
          stale_link_count: number
        }
        Insert: {
          confidence_decay_count?: number
          coverage_gap_count?: number
          details?: Json
          id?: string
          org_id: string
          orphan_count?: number
          run_at?: string
          run_day?: string | null
          stale_count?: number
          stale_link_count?: number
        }
        Update: {
          confidence_decay_count?: number
          coverage_gap_count?: number
          details?: Json
          id?: string
          org_id?: string
          orphan_count?: number
          run_at?: string
          run_day?: string | null
          stale_count?: number
          stale_link_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiki_lint_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_page_sources: {
        Row: {
          contributed_at: string
          contribution_summary: string | null
          id: string
          page_id: string
          source_id: string
          source_type: string
        }
        Insert: {
          contributed_at?: string
          contribution_summary?: string | null
          id?: string
          page_id: string
          source_id: string
          source_type: string
        }
        Update: {
          contributed_at?: string
          contribution_summary?: string | null
          id?: string
          page_id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_page_sources_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "active_org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_page_sources_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "org_wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_relationships: {
        Row: {
          confidence: number
          created_at: string
          evidence: string | null
          id: string
          org_id: string
          relationship_type: string
          source_page_id: string
          source_type: string
          target_page_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence?: string | null
          id?: string
          org_id: string
          relationship_type: string
          source_page_id: string
          source_type?: string
          target_page_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence?: string | null
          id?: string
          org_id?: string
          relationship_type?: string
          source_page_id?: string
          source_type?: string
          target_page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_relationships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_relationships_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "active_org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_relationships_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_relationships_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "active_org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_relationships_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "org_wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          confidence: number | null
          content_id: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          org_id: string
          status: string
          step_count: number | null
          steps: Json
          superseded_by: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          content_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          status?: string
          step_count?: number | null
          steps?: Json
          superseded_by?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          content_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          status?: string
          step_count?: number | null
          steps?: Json
          superseded_by?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
          {
            foreignKeyName: "workflows_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_org_wiki_pages: {
        Row: {
          app: string | null
          compilation_log: Json | null
          confidence: number | null
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string | null
          org_id: string | null
          screen: string | null
          supersedes_id: string | null
          topic: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          app?: string | null
          compilation_log?: Json | null
          confidence?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          org_id?: string | null
          screen?: string | null
          supersedes_id?: string | null
          topic?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          app?: string | null
          compilation_log?: Json | null
          confidence?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          org_id?: string | null
          screen?: string | null
          supersedes_id?: string | null
          topic?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_wiki_pages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_wiki_pages_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "active_org_wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_wiki_pages_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "org_wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      active_transcripts: {
        Row: {
          confidence: number | null
          content_id: string | null
          created_at: string | null
          id: string | null
          language: string | null
          provider: string | null
          provider_job_id: string | null
          superseded: boolean | null
          text: string | null
          updated_at: string | null
          video_metadata: Json | null
          visual_events: Json | null
          words_json: Json | null
        }
        Insert: {
          confidence?: number | null
          content_id?: string | null
          created_at?: string | null
          id?: string | null
          language?: string | null
          provider?: string | null
          provider_job_id?: string | null
          superseded?: boolean | null
          text?: string | null
          updated_at?: string | null
          video_metadata?: Json | null
          visual_events?: Json | null
          words_json?: Json | null
        }
        Update: {
          confidence?: number | null
          content_id?: string | null
          created_at?: string | null
          id?: string | null
          language?: string | null
          provider?: string | null
          provider_job_id?: string | null
          superseded?: boolean | null
          text?: string | null
          updated_at?: string | null
          video_metadata?: Json | null
          visual_events?: Json | null
          words_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      cache_effectiveness: {
        Row: {
          avg_latency_ms: number | null
          cache_hit_rate: number | null
          cache_hits: number | null
          date: string | null
          p50_latency_ms: number | null
          p95_latency_ms: number | null
          p99_latency_ms: number | null
          total_searches: number | null
        }
        Relationships: []
      }
      compression_analytics: {
        Row: {
          avg_compression_ratio: number | null
          avg_vmaf_score: number | null
          compressed_count: number | null
          compression_percentage: number | null
          effective_storage_gb: number | null
          org_id: string | null
          org_name: string | null
          total_recordings: number | null
          total_storage_gb: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_processing_progress: {
        Row: {
          completed_segments: number | null
          content_id: string | null
          content_status: string | null
          created_at: string | null
          estimated_completion_at: string | null
          processing_strategy:
            | Database["public"]["Enums"]["processing_strategy"]
            | null
          progress_percent: number | null
          searchable_chunks: number | null
          title: string | null
          total_key_moments_found: number | null
          total_segments: number | null
          updated_at: string | null
        }
        Insert: {
          completed_segments?: number | null
          content_id?: string | null
          content_status?: string | null
          created_at?: string | null
          estimated_completion_at?: string | null
          processing_strategy?:
            | Database["public"]["Enums"]["processing_strategy"]
            | null
          progress_percent?: never
          searchable_chunks?: never
          title?: string | null
          total_key_moments_found?: never
          total_segments?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_segments?: number | null
          content_id?: string | null
          content_status?: string | null
          created_at?: string | null
          estimated_completion_at?: string | null
          processing_strategy?:
            | Database["public"]["Enums"]["processing_strategy"]
            | null
          progress_percent?: never
          searchable_chunks?: never
          title?: string | null
          total_key_moments_found?: never
          total_segments?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      deduplication_stats: {
        Row: {
          actual_storage_bytes: number | null
          deduplication_ratio: number | null
          duplicate_files: number | null
          org_id: string | null
          space_saved_bytes: number | null
          space_saved_percent: number | null
          total_files: number | null
          total_storage_bytes: number | null
          unique_files: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      frame_extraction_stats: {
        Row: {
          avg_frames_per_recording: number | null
          last_24h_count: number | null
          last_7d_count: number | null
          max_frames: number | null
          min_frames: number | null
          recording_count: number | null
          status: string | null
        }
        Relationships: []
      }
      org_analytics_summary: {
        Row: {
          avg_latency: number | null
          cache_hit_rate: number | null
          date: string | null
          org_id: string | null
          p50_latency: number | null
          p95_latency: number | null
          total_searches: number | null
          unique_users: number | null
        }
        Relationships: [
          {
            foreignKeyName: "search_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      popular_queries: {
        Row: {
          avg_latency: number | null
          avg_results: number | null
          cache_hit_rate: number | null
          org_id: string | null
          query: string | null
          query_count: number | null
          unique_users: number | null
        }
        Relationships: [
          {
            foreignKeyName: "search_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quota_usage_efficiency: {
        Row: {
          avg_ai_usage: number | null
          avg_recording_usage: number | null
          avg_search_usage: number | null
          avg_storage_usage: number | null
          org_count: number | null
          plan_tier: string | null
        }
        Relationships: []
      }
      recording_view_counts: {
        Row: {
          avg_view_duration_sec: number | null
          last_viewed_at: string | null
          recording_id: string | null
          total_views: number | null
          unique_viewers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_views_content_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_views_content_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "content_processing_progress"
            referencedColumns: ["content_id"]
          },
        ]
      }
      slow_queries: {
        Row: {
          calls: number | null
          max_exec_time: number | null
          mean_exec_time: number | null
          query: string | null
          stddev_exec_time: number | null
          total_exec_time: number | null
        }
        Relationships: []
      }
      slow_quota_checks: {
        Row: {
          calls: number | null
          max_exec_time: number | null
          mean_exec_time: number | null
          query: string | null
          total_exec_time: number | null
        }
        Relationships: []
      }
      storage_metrics_realtime: {
        Row: {
          cold_tier_bytes: number | null
          cold_tier_count: number | null
          completed_count: number | null
          compressed_count: number | null
          compression_savings_bytes: number | null
          deduplicated_count: number | null
          failed_count: number | null
          glacier_tier_bytes: number | null
          glacier_tier_count: number | null
          hot_tier_bytes: number | null
          hot_tier_count: number | null
          org_id: string | null
          org_name: string | null
          pending_count: number | null
          processing_count: number | null
          r2_bytes: number | null
          r2_count: number | null
          similarity_processed_count: number | null
          snapshot_time: string | null
          supabase_bytes: number | null
          supabase_count: number | null
          total_files: number | null
          total_storage_bytes: number | null
          total_storage_gb: number | null
          warm_tier_bytes: number | null
          warm_tier_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_tier_analytics: {
        Row: {
          avg_size_mb: number | null
          file_count: number | null
          monthly_cost_usd: number | null
          newest_file: string | null
          oldest_file: string | null
          org_id: string | null
          org_name: string | null
          storage_provider:
            | Database["public"]["Enums"]["storage_provider"]
            | null
          storage_tier: Database["public"]["Enums"]["storage_tier"] | null
          total_size_gb: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_frames_storage_stats: {
        Row: {
          avg_frame_size_bytes: number | null
          newest_frame: string | null
          oldest_frame: string | null
          orgs_with_frames: number | null
          recordings_with_frames: number | null
          total_frames: number | null
          total_storage_bytes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      append_onboarding_engagement: {
        Args: {
          p_chat_question?: string
          p_content_view?: Json
          p_plan_id: string
          p_search_query?: string
        }
        Returns: boolean
      }
      are_embeddings_stale: {
        Args: { p_content_id: string; p_threshold_hours?: number }
        Returns: boolean
      }
      auto_analyze_hot_tables: { Args: never; Returns: undefined }
      batch_insert_analytics: { Args: { p_events: Json }; Returns: number }
      calculate_compression_savings: {
        Args: { p_org_id: string }
        Returns: {
          average_compression_ratio: number
          compression_percentage: number
          content_compressed: number
          content_total: number
          storage_cost_savings_usd: number
          total_bytes_saved: number
          total_compressed_bytes: number
          total_original_bytes: number
        }[]
      }
      calculate_storage_costs_by_tier: {
        Args: { p_org_id: string }
        Returns: {
          cost_per_gb: number
          file_count: number
          monthly_cost_usd: number
          provider: Database["public"]["Enums"]["storage_provider"]
          tier: Database["public"]["Enums"]["storage_tier"]
          total_size_gb: number
        }[]
      }
      can_access_resource: {
        Args: {
          p_resource_id: string
          p_resource_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_quota: {
        Args: { p_amount?: number; p_org_id: string; p_quota_type: string }
        Returns: boolean
      }
      check_quota_optimized: {
        Args: { p_amount?: number; p_org_id: string; p_quota_type: string }
        Returns: boolean
      }
      cleanup_expired_cache: {
        Args: never
        Returns: {
          deleted_count: number
          freed_bytes: number
        }[]
      }
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_orphaned_frames: {
        Args: never
        Returns: {
          deleted_count: number
        }[]
      }
      create_monthly_partitions: { Args: never; Returns: undefined }
      decrement_reference_count: {
        Args: { content_id_param: string }
        Returns: undefined
      }
      delete_concept_with_mentions: {
        Args: { p_concept_id: string; p_org_id: string }
        Returns: Json
      }
      delete_expired_search_history: { Args: never; Returns: undefined }
      drop_old_partitions: { Args: never; Returns: undefined }
      estimate_completion_time: {
        Args: { p_content_id: string }
        Returns: string
      }
      estimate_tier_migration_savings: {
        Args: { p_org_id: string }
        Returns: {
          current_monthly_cost: number
          files_to_migrate: number
          monthly_savings: number
          projected_monthly_cost: number
          savings_percent: number
          total_size_gb: number
        }[]
      }
      expire_old_invitations: { Args: never; Returns: number }
      find_compression_candidates: {
        Args: { p_limit?: number; p_min_size_mb?: number; p_org_id: string }
        Returns: {
          content_id: string
          content_type: string
          created_at: string
          file_size_mb: number
          storage_path_raw: string
          title: string
        }[]
      }
      find_files_for_deduplication: {
        Args: { p_batch_size?: number; p_org_id: string }
        Returns: {
          file_size: number
          id: string
          storage_path: string
          storage_path_r2: string
          storage_provider: string
        }[]
      }
      find_files_for_tier_migration: {
        Args: { p_batch_size?: number; p_min_age_days?: number }
        Returns: {
          age_days: number
          content_id: string
          created_at: string
          current_tier: Database["public"]["Enums"]["storage_tier"]
          file_size: number
          org_id: string
          storage_path: string
          target_tier: Database["public"]["Enums"]["storage_tier"]
          title: string
        }[]
      }
      find_similar_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          source_chunk_id: string
        }
        Returns: {
          chunk_text: string
          content_id: string
          content_title: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      find_similar_concepts: {
        Args: {
          p_embedding: string
          p_limit?: number
          p_org_id: string
          p_threshold?: number
        }
        Returns: {
          concept_id: string
          concept_type: string
          mention_count: number
          name: string
          similarity: number
        }[]
      }
      generate_api_key_prefix: {
        Args: { p_environment?: string }
        Returns: string
      }
      get_accessible_resources: {
        Args: { p_resource_type: string; p_user_id: string }
        Returns: {
          resource_id: string
        }[]
      }
      get_active_session_count: { Args: { p_user_id: string }; Returns: number }
      get_agent_action_stats: {
        Args: {
          p_agent_type?: string
          p_end_date?: string
          p_org_id: string
          p_start_date?: string
        }
        Returns: {
          avg_duration_ms: number
          failure: number
          skipped: number
          success: number
          total: number
          total_cost: number
          total_tokens: number
        }[]
      }
      get_agent_usage_by_agent: {
        Args: { p_org_id: string; p_since: string }
        Returns: {
          action_count: number
          agent_type: string
          total_credits: number
          total_tokens: number
        }[]
      }
      get_agent_usage_by_day: {
        Args: { p_org_id: string; p_since: string }
        Returns: {
          action_count: number
          day: string
          total_credits: number
          total_tokens: number
        }[]
      }
      get_agent_usage_summary: {
        Args: { p_org_id: string; p_since: string }
        Returns: {
          action_count: number
          total_credits: number
          total_tokens: number
        }[]
      }
      get_audit_log_filters: {
        Args: { p_org_id: string }
        Returns: {
          available_actions: string[]
          available_resource_types: string[]
          unique_user_count: number
        }[]
      }
      get_collection_item_counts: {
        Args: { p_org_id: string }
        Returns: {
          collection_id: string
          collection_name: string
          item_count: number
          parent_id: string
        }[]
      }
      get_compression_stats_by_content_type: {
        Args: { p_org_id: string }
        Returns: {
          avg_compressed_size_mb: number
          avg_compression_ratio: number
          avg_original_size_mb: number
          avg_ssim_score: number
          avg_vmaf_score: number
          content_count: number
          content_type: string
          total_bytes_saved: number
        }[]
      }
      get_content_concepts: {
        Args: { p_content_id: string }
        Returns: {
          concept_id: string
          concept_name: string
          concept_type: string
          confidence: number
          context: string
          mention_count: number
        }[]
      }
      get_content_view_count: {
        Args: { p_content_id: string }
        Returns: number
      }
      get_conversation_message_count: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      get_department_path: { Args: { dept_id: string }; Returns: string[] }
      get_duplicate_groups: {
        Args: { p_min_duplicates?: number; p_org_id: string }
        Returns: {
          content_ids: string[]
          duplicate_count: number
          file_hash: string
          potential_savings: number
          total_size: number
        }[]
      }
      get_frame_public_url: {
        Args: { frame_storage_path: string }
        Returns: string
      }
      get_frame_storage_path: {
        Args: { frame_num: number; org_uuid: string; recording_uuid: string }
        Returns: string
      }
      get_index_usage_stats: {
        Args: never
        Returns: {
          idx_scan: number
          idx_tup_fetch: number
          idx_tup_read: number
          index_size: string
          indexname: string
          is_primary: boolean
          is_unique: boolean
          schemaname: string
          tablename: string
        }[]
      }
      get_job_performance: {
        Args: { days_back?: number }
        Returns: {
          avg_duration: number
          failed_count: number
          job_type: string
          success_count: number
          success_rate: number
          total_count: number
        }[]
      }
      get_org_content_stats: {
        Args: { p_org_id: string }
        Returns: {
          completed_count: number
          content_count: number
          failed_count: number
          processing_count: number
          total_storage_bytes: number
        }[]
      }
      get_org_wiki_page_history: {
        Args: { p_org_id: string; p_page_id: string }
        Returns: {
          app: string
          compilation_log: Json
          confidence: number
          content: string
          created_at: string
          id: string
          org_id: string
          screen: string
          supersedes_id: string
          topic: string
          updated_at: string
          valid_from: string
          valid_until: string
        }[]
      }
      get_org_wiki_pages_as_of: {
        Args: { p_as_of: string; p_org_id: string }
        Returns: {
          app: string
          compilation_log: Json
          confidence: number
          content: string
          created_at: string
          id: string
          org_id: string
          screen: string
          supersedes_id: string
          topic: string
          updated_at: string
          valid_from: string
          valid_until: string
        }[]
      }
      get_performance_baseline: {
        Args: never
        Returns: {
          metric: string
          value: number
        }[]
      }
      get_related_concepts: {
        Args: { p_concept_id: string; p_limit?: number }
        Returns: {
          evidence_count: number
          related_concept_id: string
          related_name: string
          related_type: string
          relationship_type: string
          strength: number
        }[]
      }
      get_search_stats: {
        Args: { org_id_param: string }
        Returns: {
          avg_chunks_per_content: number
          total_chunks: number
          total_content: number
          total_document_chunks: number
          total_transcript_chunks: number
        }[]
      }
      get_tag_usage_counts: {
        Args: { p_org_id: string }
        Returns: {
          tag_color: string
          tag_id: string
          tag_name: string
          usage_count: number
        }[]
      }
      get_top_concepts: {
        Args: { p_concept_type?: string; p_limit?: number; p_org_id: string }
        Returns: {
          concept_id: string
          concept_type: string
          content_count: number
          description: string
          first_seen_at: string
          last_seen_at: string
          mention_count: number
          name: string
          normalized_name: string
        }[]
      }
      get_top_content_by_usage: {
        Args: { p_limit?: number; p_org_id: string; p_since: string }
        Returns: {
          action_count: number
          content_id: string
          total_credits: number
        }[]
      }
      get_transcript_with_visual: {
        Args: { p_content_id: string }
        Returns: {
          combined_narrative: string
          id: string
          text: string
          video_metadata: Json
          visual_events: Json
        }[]
      }
      get_user_org_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_webhooks_for_event: {
        Args: { p_event_type: string; p_org_id: string }
        Returns: {
          headers: Json
          max_retries: number
          retry_enabled: boolean
          secret: string
          timeout_ms: number
          url: string
          webhook_id: string
        }[]
      }
      hierarchical_search: {
        Args: {
          chunks_per_document?: number
          match_org_id: string
          match_threshold?: number
          query_embedding_1536: string
          query_embedding_3072: string
          top_documents?: number
        }
        Returns: {
          chunk_text: string
          content_id: string
          content_title: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
          summary_similarity: number
        }[]
      }
      hybrid_search: {
        Args: {
          filter_content_ids?: string[]
          filter_org_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          chunk_text: string
          combined_score: number
          content_id: string
          content_title: string
          created_at: string
          id: string
          keyword_rank: number
          metadata: Json
          similarity: number
        }[]
      }
      increment_batch_failed: {
        Args: { batch_id_param: string }
        Returns: undefined
      }
      increment_batch_processed: {
        Args: { batch_id_param: string }
        Returns: undefined
      }
      increment_completed_segments: {
        Args: { p_content_id: string }
        Returns: number
      }
      increment_mcp_request_count: {
        Args: { p_key_id: string }
        Returns: undefined
      }
      increment_memory_access: {
        Args: { p_id: string }
        Returns: {
          access_count: number | null
          agent_type: string
          created_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number | null
          last_accessed_at: string | null
          memory_key: string
          memory_value: string
          metadata: Json | null
          org_id: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_memory"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_reference_count: {
        Args: { content_id_param: string }
        Returns: undefined
      }
      increment_segment_completion: {
        Args: { p_merge_job_id: string }
        Returns: {
          all_complete: boolean
          completed_count: number
          total_count: number
        }[]
      }
      is_descendant_of: {
        Args: { ancestor_id: string; child_id: string }
        Returns: boolean
      }
      is_valid_uuid: { Args: { input_text: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_action_type: Database["public"]["Enums"]["activity_action"]
          p_metadata?: Json
          p_org_id: string
          p_resource_id: string
          p_resource_name?: string
          p_resource_type: Database["public"]["Enums"]["activity_resource"]
          p_user_id: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
          p_org_id: string
          p_request_id?: string
          p_resource_id?: string
          p_resource_type: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      match_agent_memories: {
        Args: {
          match_agent_type: string
          match_limit?: number
          match_org_id: string
          min_importance?: number
          query_embedding: string
        }
        Returns: {
          access_count: number
          agent_type: string
          created_at: string
          embedding: string
          expires_at: string
          id: string
          importance: number
          last_accessed_at: string
          memory_key: string
          memory_value: string
          metadata: Json
          org_id: string
          similarity: number
          updated_at: string
        }[]
      }
      match_chunks: {
        Args: {
          exclude_deleted?: boolean
          filter_content_ids?: string[]
          filter_content_types?: string[]
          filter_date_from?: string
          filter_date_to?: string
          filter_org_id?: string
          filter_source?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          content_id: string
          content_title: string
          content_type: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_org_wiki_pages: {
        Args: {
          match_limit?: number
          match_org_id: string
          query_embedding: string
        }
        Returns: {
          app: string
          confidence: number
          content: string
          distance: number
          id: string
          org_id: string
          screen: string
          topic: string
        }[]
      }
      match_org_wiki_pages_as_of: {
        Args: {
          match_as_of: string
          match_limit?: number
          match_org_id: string
          query_embedding: string
        }
        Returns: {
          app: string
          confidence: number
          content: string
          distance: number
          id: string
          org_id: string
          screen: string
          topic: string
        }[]
      }
      merge_concepts: {
        Args: { p_org_id: string; source_id: string; target_id: string }
        Returns: Json
      }
      multimodal_search: {
        Args: {
          audio_weight?: number
          match_count?: number
          match_org_id: string
          match_threshold?: number
          query_embedding_1536: string
          query_text: string
          visual_weight?: number
        }
        Returns: {
          content: string
          content_id: string
          content_title: string
          final_score: number
          metadata: Json
          result_id: string
          result_type: string
          similarity: number
          time_sec: number
        }[]
      }
      queue_frame_extraction_job: {
        Args: { content_uuid: string }
        Returns: string
      }
      record_webhook_delivery: {
        Args: {
          p_duration_ms?: number
          p_error_message?: string
          p_event_id: string
          p_event_type: string
          p_payload: Json
          p_response_body?: string
          p_response_status_code?: number
          p_status: string
          p_webhook_id: string
        }
        Returns: string
      }
      refresh_popular_queries: { Args: never; Returns: undefined }
      refresh_recording_view_counts: { Args: never; Returns: undefined }
      release_quota: {
        Args: { p_amount: number; p_column: string; p_org_id: string }
        Returns: undefined
      }
      revoke_api_key: {
        Args: { p_key_id: string; p_revoked_by: string }
        Returns: boolean
      }
      search_chunks_optimized: {
        Args: {
          p_embedding: string
          p_limit?: number
          p_org_id: string
          p_threshold?: number
        }
        Returns: {
          chunk_id: string
          content: string
          content_id: string
          similarity: number
        }[]
      }
      search_chunks_text: {
        Args: {
          filter_content_ids?: string[]
          filter_content_types?: string[]
          filter_date_from?: string
          filter_date_to?: string
          filter_org_id: string
          filter_source?: string
          match_count?: number
          search_query: string
        }
        Returns: {
          chunk_text: string
          content_id: string
          content_title: string
          content_type: string
          created_at: string
          id: string
          metadata: Json
          rank: number
        }[]
      }
      search_chunks_with_recency: {
        Args: {
          match_count?: number
          match_org_id: string
          match_threshold?: number
          query_embedding: string
          recency_decay_days?: number
          recency_weight?: number
        }
        Returns: {
          chunk_text: string
          content_id: string
          content_title: string
          created_at: string
          final_score: number
          id: string
          metadata: Json
          recency_score: number
          similarity: number
        }[]
      }
      search_frames_by_content: {
        Args: {
          include_ocr?: boolean
          match_count?: number
          match_org_id: string
          query_text: string
          scene_filter?: string
        }
        Returns: {
          content_id: string
          frame_number: number
          frame_time_sec: number
          frame_url: string
          id: string
          ocr_text: string
          relevance_score: number
          scene_type: string
          visual_description: string
        }[]
      }
      suggest_missing_indexes: {
        Args: never
        Returns: {
          attname: string
          avg_width: number
          correlation: number
          most_common_vals: string
          n_distinct: number
          null_frac: number
          tablename: string
        }[]
      }
      track_content_view: {
        Args: {
          p_content_id: string
          p_ip_address?: unknown
          p_org_id: string
          p_referrer?: string
          p_session_id?: string
          p_source?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      update_embedding_completion: {
        Args: { p_content_id: string; p_timestamp: string }
        Returns: Json
      }
      update_view_duration: {
        Args: { p_duration_sec: number; p_view_id: string }
        Returns: undefined
      }
      upsert_concept: {
        Args: {
          p_concept_type?: string
          p_description?: string
          p_embedding?: string
          p_name: string
          p_normalized_name: string
          p_org_id: string
        }
        Returns: string
      }
      upsert_published_document: {
        Args: {
          p_branding_config?: Json
          p_connector_id: string
          p_content_hash?: string
          p_content_id: string
          p_custom_title?: string
          p_destination?: string
          p_document_id: string
          p_external_id?: string
          p_external_path?: string
          p_external_url?: string
          p_folder_id?: string
          p_folder_path?: string
          p_format?: Database["public"]["Enums"]["publish_format"]
          p_org_id: string
          p_published_by?: string
        }
        Returns: {
          branding_config: Json | null
          connector_id: string
          content_hash: string | null
          content_id: string
          created_at: string
          custom_title: string | null
          deleted_at: string | null
          destination: string
          document_id: string
          document_version: number
          external_id: string
          external_path: string | null
          external_url: string
          external_version: string | null
          folder_id: string | null
          folder_path: string | null
          format: Database["public"]["Enums"]["publish_format"]
          id: string
          last_error: string | null
          last_published_at: string | null
          last_synced_at: string | null
          org_id: string
          published_by: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "published_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_has_org_access: {
        Args: { p_min_role?: string; p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      validate_api_key: {
        Args: {
          p_ip_address?: unknown
          p_key_hash: string
          p_required_scope?: string
        }
        Returns: Json
      }
      vendor_analytics_avg_latency: {
        Args: { p_since: string; p_vendor_org_id: string }
        Returns: {
          avg: number
        }[]
      }
      vendor_analytics_by_day: {
        Args: { p_since: string; p_vendor_org_id: string }
        Returns: {
          count: number
          date: string
        }[]
      }
      vendor_analytics_knowledge_gaps: {
        Args: { p_limit?: number; p_since: string; p_vendor_org_id: string }
        Returns: {
          count: number
          question: string
        }[]
      }
      vendor_analytics_top_apps: {
        Args: { p_limit?: number; p_since: string; p_vendor_org_id: string }
        Returns: {
          app: string
          count: number
        }[]
      }
      vendor_analytics_top_questions: {
        Args: { p_limit?: number; p_since: string; p_vendor_org_id: string }
        Returns: {
          count: number
          question: string
        }[]
      }
      vendor_analytics_unique_customers: {
        Args: { p_since: string; p_vendor_org_id: string }
        Returns: {
          count: number
        }[]
      }
    }
    Enums: {
      activity_action:
        | "created"
        | "updated"
        | "deleted"
        | "shared"
        | "favorited"
        | "unfavorited"
        | "tagged"
        | "untagged"
        | "moved"
        | "uploaded"
        | "transcribed"
        | "processed"
        | "viewed"
      activity_resource: "recording" | "collection" | "tag" | "note" | "share"
      blog_post_status: "draft" | "published" | "archived"
      content_type: "audio" | "visual" | "combined" | "document"
      processing_strategy: "single" | "segmented"
      publish_action: "publish" | "update" | "delete" | "sync" | "retry"
      publish_format: "native" | "markdown" | "pdf" | "html"
      publish_status:
        | "pending"
        | "published"
        | "failed"
        | "syncing"
        | "outdated"
      publish_trigger: "manual" | "auto" | "webhook" | "retry"
      segment_status: "pending" | "processing" | "completed" | "failed"
      storage_provider: "supabase" | "r2" | "cloudflare"
      storage_tier: "hot" | "warm" | "cold" | "glacier"
      vendor_fetch_strategy:
        | "markdown_export"
        | "llms_txt"
        | "static_site"
        | "official_mcp_snapshot"
        | "sanctioned_crawl"
      vendor_source_kind:
        | "documentation"
        | "developer_docs"
        | "help_center"
        | "api_reference"
        | "release_notes"
        | "mcp_snapshot"
      vendor_terms_review_status:
        | "pending"
        | "approved"
        | "restricted"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_action: [
        "created",
        "updated",
        "deleted",
        "shared",
        "favorited",
        "unfavorited",
        "tagged",
        "untagged",
        "moved",
        "uploaded",
        "transcribed",
        "processed",
        "viewed",
      ],
      activity_resource: ["recording", "collection", "tag", "note", "share"],
      blog_post_status: ["draft", "published", "archived"],
      content_type: ["audio", "visual", "combined", "document"],
      processing_strategy: ["single", "segmented"],
      publish_action: ["publish", "update", "delete", "sync", "retry"],
      publish_format: ["native", "markdown", "pdf", "html"],
      publish_status: ["pending", "published", "failed", "syncing", "outdated"],
      publish_trigger: ["manual", "auto", "webhook", "retry"],
      segment_status: ["pending", "processing", "completed", "failed"],
      storage_provider: ["supabase", "r2", "cloudflare"],
      storage_tier: ["hot", "warm", "cold", "glacier"],
      vendor_fetch_strategy: [
        "markdown_export",
        "llms_txt",
        "static_site",
        "official_mcp_snapshot",
        "sanctioned_crawl",
      ],
      vendor_source_kind: [
        "documentation",
        "developer_docs",
        "help_center",
        "api_reference",
        "release_notes",
        "mcp_snapshot",
      ],
      vendor_terms_review_status: [
        "pending",
        "approved",
        "restricted",
        "rejected",
      ],
    },
  },
} as const

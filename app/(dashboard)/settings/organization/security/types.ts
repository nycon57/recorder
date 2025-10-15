import type { Json } from '@/lib/types/database';

export interface AuditLog {
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
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface UserSession {
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
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface AuditLogFilter {
  dateRange: '24h' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
  actions: string[];
  userIds: string[];
  resourceTypes: string[];
  search: string;
}

export interface OrganizationSettings {
  require_2fa: boolean;
  session_timeout: string;
  ip_allowlist: string[];
  audit_retention_days: number;
}

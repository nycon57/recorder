import type { UserRole, UserStatus } from '@/lib/types/database';

export interface OrganizationMember {
  id: string;
  clerk_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus | null;
  title: string | null;
  department_id: string | null;
  department_name: string | null;
  departments: Department[];
  last_active_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  login_count: number | null;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

export interface MemberFiltersState {
  roles: UserRole[];
  departments: string[];
  statuses: string[];
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, parseSearchParams } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

const auditLogFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type AuditLogFilters = z.infer<typeof auditLogFiltersSchema>;

export type AuditLog = {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: any | null;
  new_values: any | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: any;
  created_at: string;
  user?: {
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
};

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const filters = parseSearchParams(request, auditLogFiltersSchema);
  const supabase = supabaseAdmin;

  // Build base query
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      user:users!audit_logs_user_id_fkey(
        name,
        email,
        avatar_url
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.from) {
    query = query.gte('created_at', new Date(filters.from).toISOString());
  }

  if (filters.to) {
    query = query.lte('created_at', new Date(filters.to).toISOString());
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.resourceType) {
    query = query.eq('resource_type', filters.resourceType);
  }

  if (filters.search) {
    // Search in action, resource_type, and metadata
    query = query.or(`action.ilike.%${filters.search}%,resource_type.ilike.%${filters.search}%`);
  }

  // Apply pagination
  const offset = (filters.page - 1) * filters.limit;
  query = query.range(offset, offset + filters.limit - 1);

  const { data: logs, error: logsError, count } = await query;

  if (logsError) {
    console.error('Error fetching audit logs:', logsError);
    throw new Error('Failed to fetch audit logs');
  }

  // OPTIMIZED: Use database function to get filter options efficiently
  // This replaces 2 separate queries + in-memory DISTINCT operations
  const { data: filterData, error: filterError } = await supabase
    .rpc('get_audit_log_filters', { p_org_id: orgId });

  let uniqueActions: string[] = [];
  let uniqueResourceTypes: string[] = [];

  if (filterError) {
    console.error('Error fetching audit log filters (falling back to basic query):', filterError);
    // Fallback: Use the old method if RPC doesn't exist yet
    const { data: actionTypes } = await supabase
      .from('audit_logs')
      .select('action')
      .eq('org_id', orgId)
      .limit(1000);

    const { data: resourceTypes } = await supabase
      .from('audit_logs')
      .select('resource_type')
      .eq('org_id', orgId)
      .limit(1000);

    uniqueActions = [...new Set(actionTypes?.map(a => a.action) || [])];
    uniqueResourceTypes = [...new Set(resourceTypes?.map(r => r.resource_type) || [])];
  } else {
    uniqueActions = filterData?.unique_actions || [];
    uniqueResourceTypes = filterData?.unique_resource_types || [];
  }

  return successResponse({
    logs: logs || [],
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / filters.limit),
    },
    filters: {
      actions: uniqueActions,
      resourceTypes: uniqueResourceTypes,
    },
  });
});

// Export audit logs as CSV
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, role } = await requireOrg();

  // Only admins and owners can export audit logs
  if (role !== 'admin' && role !== 'owner') {
    throw new Error('Insufficient permissions to export audit logs');
  }

  const body = await request.json();
  const filters = auditLogFiltersSchema.parse(body);
  const supabase = supabaseAdmin;

  // Build query for export (no pagination)
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      user:users!audit_logs_user_id_fkey(
        name,
        email
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.from) {
    query = query.gte('created_at', new Date(filters.from).toISOString());
  }

  if (filters.to) {
    query = query.lte('created_at', new Date(filters.to).toISOString());
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.resourceType) {
    query = query.eq('resource_type', filters.resourceType);
  }

  // Limit to 10000 records for export
  query = query.limit(10000);

  const { data: logs, error } = await query;

  if (error) {
    console.error('Error exporting audit logs:', error);
    throw new Error('Failed to export audit logs');
  }

  // Format logs for CSV
  const csvData = (logs || []).map((log: any) => ({
    timestamp: log.created_at,
    user: log.user?.email || 'System',
    userName: log.user?.name || '',
    action: log.action,
    resourceType: log.resource_type,
    resourceId: log.resource_id || '',
    ipAddress: log.ip_address || '',
    userAgent: log.user_agent || '',
    requestId: log.request_id || '',
  }));

  return successResponse({ data: csvData });
});
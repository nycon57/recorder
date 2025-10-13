/**
 * Connector Documents Route
 *
 * GET /api/connectors/[id]/documents - List imported documents
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/connectors/[id]/documents
 * List documents imported by this connector
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Verify connector belongs to organization
    const { data: connector } = await supabaseAdmin
      .from('connector_configs')
      .select('org_id')
      .eq('id', id)
      .single();

    if (!connector || connector.org_id !== orgId) {
      return errors.notFound('Connector');
    }

    // Build query
    let query = supabaseAdmin
      .from('imported_documents')
      .select('*', { count: 'exact' })
      .eq('connector_id', id);

    if (status) {
      query = query.eq('processing_status', status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('last_synced_at', { ascending: false });

    const { data: documents, error, count } = await query;

    if (error) {
      return errors.internalError();
    }

    return successResponse({
      documents: documents || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  }
);

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const requestId = generateRequestId();
  const { orgId } = await requireOrg();
  const { id } = await params;

  const { data: workflow, error } = await supabaseAdmin
    .from('workflows')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error || !workflow) {
    return errors.notFound('Workflow', requestId);
  }

  return successResponse({ workflow }, requestId);
});

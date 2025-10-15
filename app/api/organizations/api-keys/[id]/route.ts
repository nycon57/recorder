import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { createSupabaseClient } from '@/lib/supabase/server';

// DELETE /api/organizations/api-keys/[id] - Revoke API key
export const DELETE = apiHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { orgId, userId, role } = await requireOrg();

  // Only admins and owners can revoke API keys
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const supabase = await createSupabaseClient();

  // Verify the API key belongs to this org
  const { data: apiKey, error: fetchError } = await supabase
    .from('api_keys')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !apiKey) {
    throw new Error('API key not found');
  }

  // Update the status to revoked (soft delete)
  const { error: updateError } = await supabase
    .from('api_keys')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: userId,
    })
    .eq('id', params.id)
    .eq('org_id', orgId);

  if (updateError) throw updateError;

  // Log the revocation in audit log
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action: 'api_key.revoked',
    resource_type: 'api_key',
    resource_id: params.id,
    metadata: {
      key_name: apiKey.name,
    },
  });

  return successResponse({ message: 'API key revoked successfully' });
});
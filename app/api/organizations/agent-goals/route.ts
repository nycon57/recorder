import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireAdmin,
  requireOrg,
  successResponse,
  parseBody,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const goalTypeEnum = z.enum(['freshness', 'coverage', 'quality', 'custom']);
const goalStatusEnum = z.enum(['active', 'paused', 'achieved', 'failed']);

const createGoalSchema = z.object({
  agent_type: z.string().min(1).max(100),
  goal_description: z.string().min(1).max(1000),
  goal_type: goalTypeEnum,
  target_metric: z.string().max(255).optional().nullable(),
  target_value: z.number().optional().nullable(),
  priority: z.number().int().min(1).max(100).optional(),
});

const updateGoalSchema = z.object({
  id: z.string().uuid(),
  goal_description: z.string().min(1).max(1000).optional(),
  goal_type: goalTypeEnum.optional(),
  target_metric: z.string().max(255).optional().nullable(),
  target_value: z.number().optional().nullable(),
  current_value: z.number().optional().nullable(),
  status: goalStatusEnum.optional(),
  priority: z.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/organizations/agent-goals
// ---------------------------------------------------------------------------

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');

  // Validate status filter against allowed values
  const validStatuses = ['active', 'paused', 'achieved', 'failed'] as const;
  if (statusParam && !validStatuses.includes(statusParam as (typeof validStatuses)[number])) {
    return errors.badRequest('Invalid status parameter');
  }

  let query = supabaseAdmin
    .from('agent_goals')
    .select('*')
    .eq('org_id', orgId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (statusParam) {
    query = query.eq('status', statusParam);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[GET /api/organizations/agent-goals] Error:', error);
    return errors.internalError();
  }

  return successResponse(data ?? []);
});

// ---------------------------------------------------------------------------
// POST /api/organizations/agent-goals
// ---------------------------------------------------------------------------

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  const body = await parseBody<z.infer<typeof createGoalSchema>>(
    request,
    createGoalSchema
  );

  const { data, error } = await supabaseAdmin
    .from('agent_goals')
    .insert({
      org_id: orgId,
      agent_type: body.agent_type,
      goal_description: body.goal_description,
      goal_type: body.goal_type,
      target_metric: body.target_metric ?? null,
      target_value: body.target_value ?? null,
      priority: body.priority ?? 1,
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/organizations/agent-goals] Error:', error);
    return errors.internalError();
  }

  return successResponse(data, undefined, 201);
});

// ---------------------------------------------------------------------------
// PATCH /api/organizations/agent-goals
// ---------------------------------------------------------------------------

export const PATCH = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  const body = await parseBody<z.infer<typeof updateGoalSchema>>(
    request,
    updateGoalSchema
  );

  const { id, ...updates } = body;

  const { data, error } = await supabaseAdmin
    .from('agent_goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errors.notFound('Goal');
    }
    console.error('[PATCH /api/organizations/agent-goals] Error:', error);
    return errors.internalError();
  }

  return successResponse(data);
});

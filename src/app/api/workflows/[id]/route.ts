import { NextRequest } from 'next/server';

import type { WorkflowStep } from '@/lib/types/database';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

const FRAMES_BUCKET = process.env.FRAMES_STORAGE_BUCKET || 'video-frames';

async function resolveScreenshotUrls(steps: WorkflowStep[]): Promise<WorkflowStep[]> {
  return Promise.all(
    steps.map(async (step) => {
      if (!step.screenshotPath) return step;
      try {
        const { data } = await supabaseAdmin.storage
          .from(FRAMES_BUCKET)
          .createSignedUrl(step.screenshotPath, 3600);
        return { ...step, screenshotPath: data?.signedUrl ?? null };
      } catch {
        return { ...step, screenshotPath: null };
      }
    })
  );
}

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

  const steps = await resolveScreenshotUrls(workflow.steps);

  let supersededByContentId: string | null = null;
  if (workflow.superseded_by) {
    const { data: superseding } = await supabaseAdmin
      .from('workflows')
      .select('content_id')
      .eq('id', workflow.superseded_by)
      .single();
    supersededByContentId = superseding?.content_id ?? null;
  }

  return successResponse(
    { workflow: { ...workflow, steps }, supersededByContentId },
    requestId
  );
});

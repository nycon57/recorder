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

async function resolveScreenshotUrls(
  steps: WorkflowStep[],
): Promise<WorkflowStep[]> {
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
    }),
  );
}

export const GET = apiHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const requestId = generateRequestId();
    const [{ orgId }, { id }] = await Promise.all([requireOrg(), params]);

    const { data: workflow, error } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !workflow) {
      return errors.notFound('Workflow', requestId);
    }

    const rawSteps = Array.isArray(workflow.steps)
      ? (workflow.steps as unknown as WorkflowStep[])
      : [];
    const supersededByContentIdPromise = workflow.superseded_by
      ? supabaseAdmin
          .from('workflows')
          .select('content_id')
          .eq('id', workflow.superseded_by)
          .single()
          .then(({ data: superseding }) => superseding?.content_id ?? null)
      : Promise.resolve(null);

    const [steps, supersededByContentId] = await Promise.all([
      resolveScreenshotUrls(rawSteps),
      supersededByContentIdPromise,
    ]);

    return successResponse(
      {
        workflow: { ...workflow, steps },
        supersededByContentId,
      },
      requestId,
    );
  },
);

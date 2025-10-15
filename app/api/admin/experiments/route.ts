/**
 * Admin Experiments API
 *
 * A/B testing experiment management:
 * - List all experiments with results
 * - Create new experiments
 * - Update experiment status and configuration
 * - View experiment metrics and variant performance
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  adminCreateExperimentSchema,
  adminUpdateExperimentSchema,
} from '@/lib/validations/api';

/**
 * GET /api/admin/experiments
 * List experiments with optional filtering and performance metrics
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || null;
  const feature = searchParams.get('feature') || null;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Build query
  let query = supabaseAdmin
    .from('ab_experiments')
    .select('*', { count: 'exact' });

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }

  if (feature && feature !== 'all') {
    query = query.eq('feature', feature);
  }

  // Execute query
  const { data: experiments, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[AdminExperiments] Query error:', error);
    throw new Error('Failed to fetch experiments');
  }

  // Fetch metrics for each experiment
  const experimentsWithMetrics = await Promise.all(
    (experiments || []).map(async (exp) => {
      // Get assignment counts by variant
      const { data: assignments } = await supabaseAdmin
        .from('ab_assignments')
        .select('variant')
        .eq('experiment_id', exp.id);

      const assignmentCounts: Record<string, number> = {};
      (assignments || []).forEach((a) => {
        assignmentCounts[a.variant] = (assignmentCounts[a.variant] || 0) + 1;
      });

      // Get metrics for this experiment
      const { data: metrics } = await supabaseAdmin
        .from('ab_metrics')
        .select(
          `
          *,
          ab_assignments!inner (
            variant,
            experiment_id
          )
        `
        )
        .eq('ab_assignments.experiment_id', exp.id);

      // Calculate metrics by variant
      const metricsByVariant: Record<string, any> = {};

      (metrics || []).forEach((m: any) => {
        const variant = m.ab_assignments.variant;
        if (!metricsByVariant[variant]) {
          metricsByVariant[variant] = {
            assignments: assignmentCounts[variant] || 0,
            metrics: {} as Record<string, number[]>,
          };
        }

        if (!metricsByVariant[variant].metrics[m.metric_name]) {
          metricsByVariant[variant].metrics[m.metric_name] = [];
        }

        metricsByVariant[variant].metrics[m.metric_name].push(
          Number(m.metric_value)
        );
      });

      // Calculate averages for each metric
      Object.keys(metricsByVariant).forEach((variant) => {
        const variantData = metricsByVariant[variant];
        const avgMetrics: Record<string, number> = {};

        Object.entries(variantData.metrics).forEach(([metricName, values]) => {
          const typedValues = values as number[];
          avgMetrics[metricName] =
            typedValues.reduce((sum, v) => sum + v, 0) / typedValues.length;
        });

        variantData.avgMetrics = avgMetrics;
        variantData.sampleSize = variantData.metrics[
          Object.keys(variantData.metrics)[0]
        ]?.length || 0;
      });

      return {
        id: exp.id,
        name: exp.name,
        description: exp.description,
        feature: exp.feature,
        status: exp.status,
        variants: exp.variants,
        trafficAllocation: exp.traffic_allocation,
        startedAt: exp.started_at,
        endedAt: exp.ended_at,
        createdAt: exp.created_at,
        totalAssignments: Object.values(assignmentCounts).reduce(
          (sum: number, count: number) => sum + count,
          0
        ),
        assignmentsByVariant: assignmentCounts,
        performance: metricsByVariant,
      };
    })
  );

  return successResponse({
    experiments: experimentsWithMetrics,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: offset + limit < (count || 0),
    },
  });
});

/**
 * POST /api/admin/experiments
 * Create a new A/B test experiment
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  await requireAdmin();

  const body = await parseBody(request, adminCreateExperimentSchema);

  const { name, description, feature, variants, trafficAllocation } = body;

  // Validate traffic allocation sums to 1.0
  const totalAllocation = Object.values(trafficAllocation).reduce(
    (sum: number, val: any) => sum + val,
    0
  );

  if (Math.abs(totalAllocation - 1.0) > 0.01) {
    throw new Error('Traffic allocation must sum to 1.0 (100%)');
  }

  // Validate all variants have allocation
  const variantNames = variants.map((v) => v.name);
  const allocationKeys = Object.keys(trafficAllocation);

  if (
    !variantNames.every((name) => allocationKeys.includes(name)) ||
    !allocationKeys.every((name) => variantNames.includes(name))
  ) {
    throw new Error(
      'Traffic allocation must match variant names exactly'
    );
  }

  // Create experiment
  const { data, error } = await supabaseAdmin
    .from('ab_experiments')
    .insert({
      name,
      description,
      feature,
      variants,
      traffic_allocation: trafficAllocation,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('[AdminExperiments] Create error:', error);

    if (error.code === '23505') {
      throw new Error('Experiment with this name already exists');
    }

    throw new Error('Failed to create experiment');
  }

  return successResponse({
    message: 'Experiment created successfully',
    experiment: data,
  });
});

/**
 * PUT /api/admin/experiments
 * Update an existing experiment
 */
export const PUT = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  await requireAdmin();

  const body = await parseBody(request, adminUpdateExperimentSchema);

  const { experimentId, status, trafficAllocation, description } = body;

  // Build update object
  const updates: any = {};

  if (status !== undefined) {
    updates.status = status;

    // Set timestamps based on status changes
    if (status === 'running' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    } else if (status === 'completed' && !updates.ended_at) {
      updates.ended_at = new Date().toISOString();
    }
  }

  if (trafficAllocation !== undefined) {
    // Validate traffic allocation sums to 1.0
    const totalAllocation = Object.values(trafficAllocation).reduce(
      (sum: number, val: any) => sum + val,
      0
    );

    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      throw new Error('Traffic allocation must sum to 1.0 (100%)');
    }

    updates.traffic_allocation = trafficAllocation;
  }

  if (description !== undefined) {
    updates.description = description;
  }

  // Update experiment
  const { data, error } = await supabaseAdmin
    .from('ab_experiments')
    .update(updates)
    .eq('id', experimentId)
    .select()
    .single();

  if (error) {
    console.error('[AdminExperiments] Update error:', error);
    throw new Error('Failed to update experiment');
  }

  return successResponse({
    message: 'Experiment updated successfully',
    experiment: data,
  });
});

/**
 * DELETE /api/admin/experiments
 * Delete an experiment (and all associated data)
 */
export const DELETE = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get('experimentId');

  if (!experimentId) {
    throw new Error('Experiment ID is required');
  }

  // Check if experiment can be deleted (only draft or completed)
  const { data: experiment } = await supabaseAdmin
    .from('ab_experiments')
    .select('status')
    .eq('id', experimentId)
    .single();

  if (!experiment) {
    throw new Error('Experiment not found');
  }

  if (experiment.status === 'running') {
    throw new Error('Cannot delete a running experiment. Pause it first.');
  }

  // Delete experiment (cascade will delete assignments and metrics)
  const { error } = await supabaseAdmin
    .from('ab_experiments')
    .delete()
    .eq('id', experimentId);

  if (error) {
    console.error('[AdminExperiments] Delete error:', error);
    throw new Error('Failed to delete experiment');
  }

  return successResponse({
    message: 'Experiment deleted successfully',
  });
});

import { createClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  feature: string;
  variants: Array<{
    name: string;
    config: Record<string, any>;
  }>;
  trafficAllocation: Record<string, number>;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt?: Date;
  endedAt?: Date;
}

export interface ExperimentAssignment {
  experimentId: string;
  variant: string;
  config: Record<string, any>;
}

export class ABTestManager {
  /**
   * Get variant assignment for user
   */
  static async getAssignment(
    experimentName: string,
    orgId: string,
    userId?: string
  ): Promise<ExperimentAssignment | null> {
    const supabase = await createClient();

    // Get experiment
    const { data: experiment, error } = await supabase
      .from('ab_experiments')
      .select('*')
      .eq('name', experimentName)
      .eq('status', 'running')
      .single();

    if (error || !experiment) {
      return null;
    }

    // Check existing assignment
    const { data: existing } = await supabase
      .from('ab_assignments')
      .select('*')
      .eq('experiment_id', experiment.id)
      .eq('org_id', orgId)
      .eq('user_id', userId || null)
      .single();

    if (existing) {
      return {
        experimentId: experiment.id,
        variant: existing.variant,
        config: this.getVariantConfig(experiment, existing.variant),
      };
    }

    // Assign new variant
    const variant = this.selectVariant(
      experiment.traffic_allocation,
      `${orgId}:${userId || 'org'}`
    );

    await supabase.from('ab_assignments').insert({
      experiment_id: experiment.id,
      org_id: orgId,
      user_id: userId || null,
      variant,
    });

    return {
      experimentId: experiment.id,
      variant,
      config: this.getVariantConfig(experiment, variant),
    };
  }

  /**
   * Record experiment metric
   */
  static async recordMetric(
    experimentId: string,
    assignmentId: string,
    metricName: string,
    metricValue: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = await createClient();

    await supabase.from('ab_metrics').insert({
      assignment_id: assignmentId,
      experiment_id: experimentId,
      metric_name: metricName,
      metric_value: metricValue,
      metadata: metadata || {},
    });
  }

  /**
   * Get experiment results
   */
  static async getResults(experimentId: string): Promise<{
    variants: Record<string, {
      assignments: number;
      metrics: Record<string, {
        mean: number;
        stddev: number;
        samples: number;
      }>;
    }>;
  }> {
    const supabase = await createClient();

    // Get all assignments
    const { data: assignments } = await supabase
      .from('ab_assignments')
      .select('*')
      .eq('experiment_id', experimentId);

    if (!assignments || assignments.length === 0) {
      return { variants: {} };
    }

    // Get all metrics
    const { data: metrics } = await supabase
      .from('ab_metrics')
      .select('*')
      .eq('experiment_id', experimentId);

    // Aggregate by variant
    const variantStats: Record<string, any> = {};

    for (const assignment of assignments) {
      const variant = assignment.variant;

      if (!variantStats[variant]) {
        variantStats[variant] = {
          assignments: 0,
          metrics: {},
        };
      }

      variantStats[variant].assignments++;

      // Aggregate metrics for this variant
      const variantMetrics = metrics?.filter((m) => m.assignment_id === assignment.id) || [];

      for (const metric of variantMetrics) {
        const metricName = metric.metric_name;

        if (!variantStats[variant].metrics[metricName]) {
          variantStats[variant].metrics[metricName] = {
            values: [],
          };
        }

        variantStats[variant].metrics[metricName].values.push(metric.metric_value);
      }
    }

    // Compute statistics
    for (const variant in variantStats) {
      for (const metricName in variantStats[variant].metrics) {
        const values = variantStats[variant].metrics[metricName].values;

        const mean = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
        const variance = values.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stddev = Math.sqrt(variance);

        variantStats[variant].metrics[metricName] = {
          mean,
          stddev,
          samples: values.length,
        };
      }
    }

    return { variants: variantStats };
  }

  /**
   * Select variant based on traffic allocation
   * Uses consistent hashing for stable assignment
   */
  private static selectVariant(
    allocation: Record<string, number>,
    identifier: string
  ): string {
    // Hash identifier to get consistent value [0, 1)
    const hash = createHash('sha256').update(identifier).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;

    // Select variant based on cumulative allocation
    let cumulative = 0;

    for (const [variant, weight] of Object.entries(allocation)) {
      cumulative += weight;

      if (hashValue < cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return Object.keys(allocation)[0];
  }

  /**
   * Get variant configuration
   */
  private static getVariantConfig(
    experiment: any,
    variantName: string
  ): Record<string, any> {
    const variant = experiment.variants.find((v: any) => v.name === variantName);
    return variant?.config || {};
  }
}

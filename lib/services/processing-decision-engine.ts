/**
 * Processing Decision Engine
 *
 * Cost-aware intelligent decision system for content processing:
 * - Optimize processing pipeline based on content analysis
 * - Balance quality vs cost tradeoffs
 * - Enforce budget limits per organization
 * - Smart job scheduling and prioritization
 */

import { createClient } from '@/lib/supabase/admin';
import type { ContentAnalysisResult } from './content-analyzer';
import type { ContentType, JobType, OrganizationPlan } from '@/lib/types/database';

/**
 * Organization budget configuration
 */
export interface OrganizationBudget {
  /** Organization ID */
  orgId: string;
  /** Organization plan tier */
  plan: OrganizationPlan;
  /** Monthly processing budget in credits (1 credit = $0.01) */
  monthlyBudget: number;
  /** Credits used this month */
  creditsUsed: number;
  /** Credits remaining */
  creditsRemaining: number;
  /** Auto-upgrade to paid tier if budget exceeded */
  autoUpgrade: boolean;
}

/**
 * Processing decision result
 */
export interface ProcessingDecision {
  /** Whether to proceed with processing */
  shouldProcess: boolean;
  /** Jobs to create and their priority */
  jobs: Array<{
    type: JobType;
    priority: number;
    estimatedCost: number;
    payload: any;
  }>;
  /** Total estimated cost */
  totalCost: number;
  /** Reason for decision */
  reason: string;
  /** Budget warning if applicable */
  budgetWarning?: string;
}

/**
 * Default budget limits by plan
 */
const DEFAULT_BUDGETS: Record<OrganizationPlan, number> = {
  free: 100,        // $1.00/month in credits
  pro: 1000,        // $10.00/month
  enterprise: 10000, // $100.00/month
};

/**
 * Job cost multipliers
 */
const JOB_COSTS = {
  transcribe: 0.10,           // $0.10 per minute
  compress_video: 0.05,       // $0.05 per GB
  compress_audio: 0.02,       // $0.02 per GB
  doc_generate: 0.05,         // $0.05 per document
  generate_embeddings: 0.03,  // $0.03 per document
  extract_frames: 0.02,       // $0.02 per minute
};

/**
 * Get organization budget status
 */
export async function getOrganizationBudget(orgId: string): Promise<OrganizationBudget> {
  const supabase = createClient();

  // Get organization plan
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single();

  const plan = (org?.plan as OrganizationPlan) || 'free';
  const monthlyBudget = DEFAULT_BUDGETS[plan];

  // Get current month's usage
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: usage } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('org_id', orgId)
    .eq('period', currentPeriod)
    .single();

  // Calculate credits used (simplified - in production, track detailed costs)
  const creditsUsed = usage
    ? Math.round(
        (usage.minutes_transcribed || 0) * 0.1 +
        (usage.storage_gb || 0) * 0.05 +
        (usage.recordings_count || 0) * 0.08
      )
    : 0;

  return {
    orgId,
    plan,
    monthlyBudget,
    creditsUsed,
    creditsRemaining: Math.max(0, monthlyBudget - creditsUsed),
    autoUpgrade: false, // TODO: Get from org settings
  };
}

/**
 * Check if organization has sufficient budget
 */
export async function checkBudget(
  orgId: string,
  estimatedCost: number
): Promise<{ allowed: boolean; budget: OrganizationBudget; warning?: string }> {
  const budget = await getOrganizationBudget(orgId);

  // Enterprise plans have unlimited budget
  if (budget.plan === 'enterprise') {
    return { allowed: true, budget };
  }

  // Check if cost would exceed budget
  if (estimatedCost > budget.creditsRemaining) {
    const warning = `Processing cost ($${(estimatedCost / 100).toFixed(2)}) would exceed remaining budget ($${(budget.creditsRemaining / 100).toFixed(2)})`;

    // Allow if auto-upgrade is enabled
    if (budget.autoUpgrade) {
      return {
        allowed: true,
        budget,
        warning: `${warning}. Auto-upgrade enabled.`,
      };
    }

    return {
      allowed: false,
      budget,
      warning,
    };
  }

  // Warn if approaching budget limit (80%)
  const usagePercent = ((budget.creditsUsed + estimatedCost) / budget.monthlyBudget) * 100;
  if (usagePercent >= 80) {
    return {
      allowed: true,
      budget,
      warning: `Budget usage will be ${usagePercent.toFixed(0)}% after this processing.`,
    };
  }

  return { allowed: true, budget };
}

/**
 * Make intelligent processing decision based on content analysis
 */
export async function makeProcessingDecision(
  recordingId: string,
  orgId: string,
  contentType: ContentType,
  analysisResult: ContentAnalysisResult,
  fileSize: number,
  duration: number
): Promise<ProcessingDecision> {
  const supabase = createClient();

  // 1. Check budget
  const budgetCheck = await checkBudget(orgId, analysisResult.estimatedCost);

  if (!budgetCheck.allowed) {
    return {
      shouldProcess: false,
      jobs: [],
      totalCost: 0,
      reason: budgetCheck.warning || 'Budget exceeded',
      budgetWarning: budgetCheck.warning,
    };
  }

  // 2. Build processing jobs based on content analysis
  const jobs: ProcessingDecision['jobs'] = [];
  const fileSizeGB = fileSize / 1024 / 1024 / 1024;
  const durationMin = duration / 60;

  // 2.1: Compression (unless skipped)
  if (!analysisResult.skipProcessing.compression) {
    const compressionType =
      contentType === 'audio' || analysisResult.category === 'podcast'
        ? 'compress_audio'
        : 'compress_video';

    jobs.push({
      type: compressionType,
      priority: analysisResult.processingPriority,
      estimatedCost: Math.round(fileSizeGB * JOB_COSTS[compressionType] * 100),
      payload: {
        recordingId,
        orgId,
        profile: analysisResult.recommendedProfile,
        contentType,
      },
    });
  }

  // 2.2: Transcription (unless skipped)
  if (
    !analysisResult.skipProcessing.transcription &&
    analysisResult.transcriptionProvider !== 'none'
  ) {
    jobs.push({
      type: 'transcribe',
      priority: analysisResult.processingPriority - 1, // Higher priority
      estimatedCost: Math.round(durationMin * JOB_COSTS.transcribe * 100),
      payload: {
        recordingId,
        orgId,
        provider: analysisResult.transcriptionProvider,
        contentCategory: analysisResult.category,
      },
    });
  }

  // 2.3: Document Generation (unless skipped)
  if (!analysisResult.skipProcessing.docGeneration) {
    jobs.push({
      type: 'doc_generate',
      priority: analysisResult.processingPriority,
      estimatedCost: Math.round(JOB_COSTS.doc_generate * 100),
      payload: {
        recordingId,
        orgId,
        contentCategory: analysisResult.category,
      },
    });
  }

  // 2.4: Embeddings (unless skipped)
  if (!analysisResult.skipProcessing.embeddings) {
    jobs.push({
      type: 'generate_embeddings',
      priority: analysisResult.processingPriority + 1, // Lower priority
      estimatedCost: Math.round(JOB_COSTS.generate_embeddings * 100),
      payload: {
        recordingId,
        orgId,
      },
    });
  }

  // 2.5: Frame Extraction (for high-value visual content)
  if (
    analysisResult.category === 'code_demo' ||
    analysisResult.category === 'tutorial' ||
    (analysisResult.sceneComplexity && analysisResult.sceneComplexity.complexity > 0.6)
  ) {
    jobs.push({
      type: 'extract_frames',
      priority: analysisResult.processingPriority + 2, // Lowest priority
      estimatedCost: Math.round(durationMin * JOB_COSTS.extract_frames * 100),
      payload: {
        recordingId,
        orgId,
        frameInterval: analysisResult.category === 'code_demo' ? 5 : 10, // More frames for code demos
      },
    });
  }

  // 3. Calculate total cost
  const totalCost = jobs.reduce((sum, job) => sum + job.estimatedCost, 0);

  // 4. Re-check budget with actual cost
  const finalBudgetCheck = await checkBudget(orgId, totalCost);
  if (!finalBudgetCheck.allowed) {
    // Try to reduce costs by skipping low-priority jobs
    const reducedJobs = jobs
      .sort((a, b) => a.priority - b.priority) // Sort by priority (lower = higher priority)
      .filter((job) => job.priority <= 3); // Keep only high-priority jobs

    const reducedCost = reducedJobs.reduce((sum, job) => sum + job.estimatedCost, 0);
    const reducedBudgetCheck = await checkBudget(orgId, reducedCost);

    if (reducedBudgetCheck.allowed) {
      return {
        shouldProcess: true,
        jobs: reducedJobs,
        totalCost: reducedCost,
        reason: `Budget constraint: Processing only high-priority jobs (${reducedJobs.length}/${jobs.length})`,
        budgetWarning: reducedBudgetCheck.warning,
      };
    }

    return {
      shouldProcess: false,
      jobs: [],
      totalCost: 0,
      reason: finalBudgetCheck.warning || 'Budget exceeded even with reduced job set',
      budgetWarning: finalBudgetCheck.warning,
    };
  }

  // 5. Log decision
  console.log(
    `[ProcessingDecision] Recording ${recordingId}: ${jobs.length} jobs, $${(totalCost / 100).toFixed(2)} cost`
  );

  return {
    shouldProcess: true,
    jobs,
    totalCost,
    reason: `Content category: ${analysisResult.category}. Priority: ${analysisResult.processingPriority}/5. Scheduled ${jobs.length} jobs.`,
    budgetWarning: finalBudgetCheck.warning,
  };
}

/**
 * Track processing cost
 */
export async function trackProcessingCost(
  orgId: string,
  jobType: JobType,
  actualCost: number,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = createClient();

  // Update usage counters
  const currentPeriod = new Date().toISOString().slice(0, 7);

  // Simplified cost tracking - in production, you'd have a detailed costs table
  await supabase
    .from('usage_counters')
    .upsert(
      {
        org_id: orgId,
        period: currentPeriod,
        // Increment appropriate counter based on job type
        ...(jobType === 'transcribe' && { minutes_transcribed: metadata?.duration || 0 }),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'org_id,period',
      }
    );

  console.log(
    `[ProcessingCost] Tracked ${jobType} cost: $${(actualCost / 100).toFixed(2)} for org ${orgId}`
  );
}

/**
 * Get processing cost analytics for organization
 */
export async function getProcessingCostAnalytics(
  orgId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCost: number;
  costByJobType: Record<JobType, number>;
  costByMonth: Array<{ period: string; cost: number }>;
  avgCostPerRecording: number;
  topCostCategories: Array<{ category: string; cost: number; count: number }>;
}> {
  const supabase = createClient();

  // For now, return simplified analytics
  // In production, you'd query a detailed processing_costs table
  const { data: usage } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('org_id', orgId)
    .order('period', { ascending: false })
    .limit(12); // Last 12 months

  const costByMonth =
    usage?.map((u) => ({
      period: u.period,
      cost: Math.round(
        (u.minutes_transcribed || 0) * 0.1 +
        (u.storage_gb || 0) * 0.05 +
        (u.recordings_count || 0) * 0.08
      ),
    })) || [];

  const totalCost = costByMonth.reduce((sum, m) => sum + m.cost, 0);
  const avgCostPerRecording = usage?.[0]?.recordings_count
    ? Math.round(totalCost / usage[0].recordings_count)
    : 0;

  return {
    totalCost,
    costByJobType: {
      transcribe: Math.round(totalCost * 0.5),
      doc_generate: Math.round(totalCost * 0.2),
      compress_video: Math.round(totalCost * 0.15),
      compress_audio: Math.round(totalCost * 0.05),
      generate_embeddings: Math.round(totalCost * 0.1),
    } as any,
    costByMonth,
    avgCostPerRecording,
    topCostCategories: [], // TODO: Implement category tracking
  };
}

/**
 * Optimize processing queue based on budget and priority
 */
export async function optimizeProcessingQueue(
  orgId: string,
  maxJobs: number = 10
): Promise<{
  optimizedJobs: Array<{ jobId: string; priority: number; estimatedCost: number }>;
  totalCost: number;
  skippedJobs: number;
}> {
  const supabase = createClient();
  const budget = await getOrganizationBudget(orgId);

  // Get pending jobs for organization
  const { data: pendingJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  if (!pendingJobs || pendingJobs.length === 0) {
    return {
      optimizedJobs: [],
      totalCost: 0,
      skippedJobs: 0,
    };
  }

  // Estimate cost for each job
  const jobsWithCost = pendingJobs.map((job) => ({
    jobId: job.id,
    type: job.type as JobType,
    priority: (job.payload as any)?.priority || 3,
    estimatedCost: JOB_COSTS[job.type as keyof typeof JOB_COSTS] || 5,
  }));

  // Sort by priority (ascending - lower number = higher priority)
  jobsWithCost.sort((a, b) => a.priority - b.priority);

  // Select jobs that fit within budget
  const optimizedJobs: typeof jobsWithCost = [];
  let totalCost = 0;

  for (const job of jobsWithCost) {
    if (optimizedJobs.length >= maxJobs) break;

    if (budget.plan !== 'enterprise' && totalCost + job.estimatedCost > budget.creditsRemaining) {
      break; // Budget exceeded
    }

    optimizedJobs.push(job);
    totalCost += job.estimatedCost;
  }

  return {
    optimizedJobs,
    totalCost,
    skippedJobs: jobsWithCost.length - optimizedJobs.length,
  };
}

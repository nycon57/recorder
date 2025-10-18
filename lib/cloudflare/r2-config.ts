/**
 * Cloudflare R2 Configuration
 *
 * Multi-tier storage configuration for cost optimization:
 * - Hot Tier (Supabase): Recent files (< 30 days)
 * - Warm Tier (R2): Older files (30-180 days)
 * - Cold Tier (R2): Archive (> 180 days)
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
  region?: string;
}

export interface StorageTierConfig {
  name: 'hot' | 'warm' | 'cold';
  provider: 'supabase' | 'r2';
  ageThresholdDays: number;
  costPerGBMonth: number;
  description: string;
}

/**
 * Storage tier configuration
 */
export const STORAGE_TIERS: StorageTierConfig[] = [
  {
    name: 'hot',
    provider: 'supabase',
    ageThresholdDays: 0,
    costPerGBMonth: 0.021,
    description: 'Recent files (< 30 days) - Fast access via Supabase',
  },
  {
    name: 'warm',
    provider: 'r2',
    ageThresholdDays: 30,
    costPerGBMonth: 0.015,
    description: 'Older files (30-180 days) - Cloudflare R2 with zero egress',
  },
  {
    name: 'cold',
    provider: 'r2',
    ageThresholdDays: 180,
    costPerGBMonth: 0.01,
    description: 'Archive (> 180 days) - Infrequent access',
  },
];

/**
 * Get R2 configuration from environment variables
 */
export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'recorder-storage';
  const publicUrl = process.env.R2_PUBLIC_URL;
  const region = process.env.R2_REGION || 'auto';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 configuration missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.'
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
    region,
  };
}

/**
 * Get storage tier based on file age
 */
export function getStorageTier(ageInDays: number): StorageTierConfig {
  // Find the appropriate tier based on age
  const tier = STORAGE_TIERS.slice()
    .reverse()
    .find((t) => ageInDays >= t.ageThresholdDays);

  return tier || STORAGE_TIERS[0]; // Default to hot tier
}

/**
 * Get storage tier by name
 */
export function getStorageTierByName(
  name: 'hot' | 'warm' | 'cold'
): StorageTierConfig | undefined {
  return STORAGE_TIERS.find((t) => t.name === name);
}

/**
 * Calculate age in days from date
 */
export function calculateAgeInDays(createdAt: string | Date): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine if file should be migrated to next tier
 */
export function shouldMigrateFile(
  currentTier: 'hot' | 'warm' | 'cold',
  ageInDays: number
): { shouldMigrate: boolean; targetTier?: 'warm' | 'cold' } {
  const optimalTier = getStorageTier(ageInDays);

  // Check if current tier matches optimal tier
  if (currentTier === optimalTier.name) {
    return { shouldMigrate: false };
  }

  // Don't downgrade (e.g., cold -> warm)
  const tierOrder: Record<string, number> = { hot: 0, warm: 1, cold: 2 };
  if (tierOrder[currentTier] > tierOrder[optimalTier.name]) {
    return { shouldMigrate: false };
  }

  return {
    shouldMigrate: true,
    targetTier: optimalTier.name as 'warm' | 'cold',
  };
}

/**
 * R2 endpoint URL builder
 */
export function getR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * Validate R2 configuration
 */
export function validateR2Config(): {
  valid: boolean;
  error?: string;
  config?: R2Config;
} {
  try {
    const config = getR2Config();
    return { valid: true, config };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid R2 configuration',
    };
  }
}

/**
 * Cost calculation for storage tiers
 */
export function calculateStorageCost(
  sizeBytes: number,
  tier: 'hot' | 'warm' | 'cold'
): number {
  const sizeGB = sizeBytes / 1024 / 1024 / 1024;
  const tierConfig = getStorageTierByName(tier);
  return tierConfig ? sizeGB * tierConfig.costPerGBMonth : 0;
}

/**
 * Estimate savings from tier migration
 */
export function estimateMigrationSavings(
  sizeBytes: number,
  fromTier: 'hot' | 'warm' | 'cold',
  toTier: 'warm' | 'cold'
): {
  currentCost: number;
  newCost: number;
  savings: number;
  savingsPercent: number;
} {
  const currentCost = calculateStorageCost(sizeBytes, fromTier);
  const newCost = calculateStorageCost(sizeBytes, toTier);
  const savings = currentCost - newCost;
  const savingsPercent = currentCost > 0 ? (savings / currentCost) * 100 : 0;

  return {
    currentCost,
    newCost,
    savings,
    savingsPercent,
  };
}

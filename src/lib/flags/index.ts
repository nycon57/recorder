/**
 * Feature flags -- PostHog flags with env var fallback.
 * When PostHog is not configured, falls back to FEATURE_[NAME] env vars.
 */

const FLAGS = {
  maintenance_mode: false,
  new_user_onboarding: true,
  beta_features: false,
  ai_features_enabled: true,
  show_upgrade_prompt: true,
} as const;

type FlagKey = keyof typeof FLAGS;

export function getFlag(key: FlagKey): boolean {
  // Check env var override first: FEATURE_MAINTENANCE_MODE=true
  const envKey = `FEATURE_${key.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    return envVal === 'true' || envVal === '1';
  }
  return FLAGS[key];
}

export function getAllFlags(): Record<FlagKey, boolean> {
  return Object.fromEntries(
    Object.keys(FLAGS).map((key) => [key, getFlag(key as FlagKey)])
  ) as Record<FlagKey, boolean>;
}

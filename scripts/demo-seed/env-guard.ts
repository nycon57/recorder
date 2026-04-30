/**
 * Three-layer production guard for the demo seed script.
 *
 * Layer 1: DEMO_SEED_ENABLED=1 must be present.
 * Layer 2: DIRECT_DATABASE_URL host must match the allowlist for --env.
 * Layer 3: Project ref must NOT be the prod Supabase ref.
 *
 * Only logs the last 6 chars of the project ref to avoid full-URL leakage.
 *
 * @pure — no side effects; callers decide what to do with the result.
 */

export type SeedEnv = 'local' | 'staging';

export interface GuardResult {
  ok: boolean;
  /** Exit code to use when ok=false. 2 = prod ref hit, 1 = other. */
  exitCode?: 1 | 2;
  reason?: string;
}

// Production Supabase project ref — NEVER seed here.
const PROD_PROJECT_REF = 'clpatptmumyasbypvmun';

// Host allowlists per environment.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal'];

// Staging host pattern: Supabase pooler / direct URLs contain the staging ref.
// We look for any host that contains a ref other than prod.
// Staging refs are typically <project_ref>.pooler.supabase.com or
// db.<project_ref>.supabase.co — none of which will be localhost.
const STAGING_HOST_PATTERNS = ['.pooler.supabase.com', '.supabase.co'];

/**
 * Extract the hostname from a postgres connection string.
 * Supports postgres:// and postgresql:// schemes.
 */
export function extractHost(connectionString: string): string | null {
  try {
    // Normalize scheme so URL can parse it.
    const normalized = connectionString.replace(/^postgres:\/\//, 'postgresql://');
    const url = new URL(normalized);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Extract the Supabase project ref from a direct DB URL.
 * db.<ref>.supabase.co  →  <ref>
 * <ref>.pooler.supabase.com  →  <ref>
 * localhost / 127.0.0.1  →  null (no ref)
 */
export function extractProjectRef(connectionString: string): string | null {
  const host = extractHost(connectionString);
  if (!host) return null;

  // db.<ref>.supabase.co
  const directMatch = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  if (directMatch) return directMatch[1];

  // <ref>.pooler.supabase.com
  const poolerMatch = host.match(/^([a-z0-9]+)\.pooler\.supabase\.com$/);
  if (poolerMatch) return poolerMatch[1];

  return null;
}

/**
 * Run all three guard layers. Returns GuardResult synchronously.
 */
export function checkGuard(opts: {
  env: SeedEnv;
  stagingConfirmToken: string | undefined;
  envRecord?: Partial<Record<string, string | undefined>>;
}): GuardResult {
  const env = opts.envRecord ?? process.env;

  // Layer 1: Explicit opt-in flag.
  if (env['DEMO_SEED_ENABLED'] !== '1') {
    return {
      ok: false,
      exitCode: 1,
      reason:
        'DEMO_SEED_ENABLED is not set to "1". Set it explicitly to allow seeding.',
    };
  }

  const dbUrl = env['DIRECT_DATABASE_URL'];
  if (!dbUrl) {
    return {
      ok: false,
      exitCode: 1,
      reason: 'DIRECT_DATABASE_URL is not set.',
    };
  }

  const host = extractHost(dbUrl);
  if (!host) {
    return {
      ok: false,
      exitCode: 1,
      reason: `Could not parse host from DIRECT_DATABASE_URL.`,
    };
  }

  // Layer 3: Prod ref denylist — checked before allowlist to fail loudly.
  const ref = extractProjectRef(dbUrl);
  if (ref === PROD_PROJECT_REF || host.includes(PROD_PROJECT_REF)) {
    const tail = PROD_PROJECT_REF.slice(-6);
    return {
      ok: false,
      exitCode: 2,
      reason:
        `\n\n` +
        `  ████████████████████████████████████████████████████████\n` +
        `  █                                                      █\n` +
        `  █   PRODUCTION DATABASE DETECTED — ABORTING           █\n` +
        `  █                                                      █\n` +
        `  █   Project ref: ...${tail}                            █\n` +
        `  █   This script refuses to seed into production.       █\n` +
        `  █                                                      █\n` +
        `  ████████████████████████████████████████████████████████\n`,
    };
  }

  // Layer 2: Host allowlist.
  if (opts.env === 'local') {
    if (!LOCAL_HOSTS.includes(host)) {
      return {
        ok: false,
        exitCode: 1,
        reason: `--env=local requires a local host. Got: "${host}". Allowed: ${LOCAL_HOSTS.join(', ')}.`,
      };
    }
  } else if (opts.env === 'staging') {
    const isStaging = STAGING_HOST_PATTERNS.some((pattern) =>
      host.endsWith(pattern)
    );
    if (!isStaging) {
      return {
        ok: false,
        exitCode: 1,
        reason:
          `--env=staging requires a Supabase staging host. Got: "${host}". ` +
          `Expected a host ending with: ${STAGING_HOST_PATTERNS.join(' or ')}.`,
      };
    }

    // Staging requires a confirmation token.
    const expectedToken = env['DEMO_SEED_STAGING_CONFIRM'];
    if (!expectedToken) {
      return {
        ok: false,
        exitCode: 1,
        reason:
          'DEMO_SEED_STAGING_CONFIRM is not set. Set it and pass --confirm=<token>.',
      };
    }
    if (opts.stagingConfirmToken !== expectedToken) {
      return {
        ok: false,
        exitCode: 1,
        reason:
          `--confirm token does not match DEMO_SEED_STAGING_CONFIRM. ` +
          `Pass the correct value to proceed.`,
      };
    }
  }

  return { ok: true };
}

/* global describe, expect, it */

import { checkGuard, extractHost, extractProjectRef } from '../env-guard';

// ─── extractHost ──────────────────────────────────────────────────────────────

describe('extractHost', () => {
  it('parses localhost', () => {
    expect(extractHost('postgresql://user:pass@localhost:5432/db')).toBe('localhost');
  });

  it('parses 127.0.0.1', () => {
    expect(extractHost('postgresql://user:pass@127.0.0.1:5432/db')).toBe('127.0.0.1');
  });

  it('parses Supabase direct host', () => {
    expect(
      extractHost('postgresql://postgres:pass@db.abcdef123456.supabase.co:5432/postgres')
    ).toBe('db.abcdef123456.supabase.co');
  });

  it('parses Supabase pooler host', () => {
    expect(
      extractHost('postgresql://postgres:pass@abcdef123456.pooler.supabase.com:6543/postgres')
    ).toBe('abcdef123456.pooler.supabase.com');
  });

  it('parses postgres:// scheme', () => {
    expect(extractHost('postgres://user:pass@localhost:5432/db')).toBe('localhost');
  });

  it('returns null for unparseable input', () => {
    expect(extractHost('not-a-url')).toBeNull();
  });
});

// ─── extractProjectRef ────────────────────────────────────────────────────────

describe('extractProjectRef', () => {
  it('extracts ref from direct URL', () => {
    expect(
      extractProjectRef('postgresql://postgres:pass@db.abcdef123456.supabase.co:5432/postgres')
    ).toBe('abcdef123456');
  });

  it('extracts ref from pooler URL', () => {
    expect(
      extractProjectRef('postgresql://postgres:pass@abcdef123456.pooler.supabase.com:6543/postgres')
    ).toBe('abcdef123456');
  });

  it('returns null for localhost', () => {
    expect(extractProjectRef('postgresql://user:pass@localhost:5432/db')).toBeNull();
  });
});

// ─── checkGuard ───────────────────────────────────────────────────────────────

const LOCAL_URL = 'postgresql://postgres:pass@localhost:5432/postgres';
const STAGING_URL = 'postgresql://postgres:pass@abcdef123456.pooler.supabase.com:6543/postgres';
const PROD_URL = 'postgresql://postgres:pass@db.clpatptmumyasbypvmun.supabase.co:5432/postgres';
const PROD_POOLER_URL = 'postgresql://postgres:pass@clpatptmumyasbypvmun.pooler.supabase.com:6543/postgres';

describe('checkGuard — missing DEMO_SEED_ENABLED', () => {
  it('rejects when DEMO_SEED_ENABLED is absent', () => {
    const result = checkGuard({
      env: 'local',
      stagingConfirmToken: undefined,
      envRecord: { DIRECT_DATABASE_URL: LOCAL_URL },
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.reason).toMatch(/DEMO_SEED_ENABLED/);
  });

  it('rejects when DEMO_SEED_ENABLED is "0"', () => {
    const result = checkGuard({
      env: 'local',
      stagingConfirmToken: undefined,
      envRecord: { DEMO_SEED_ENABLED: '0', DIRECT_DATABASE_URL: LOCAL_URL },
    });
    expect(result.ok).toBe(false);
  });
});

describe('checkGuard — local env', () => {
  it('allows localhost', () => {
    const result = checkGuard({
      env: 'local',
      stagingConfirmToken: undefined,
      envRecord: { DEMO_SEED_ENABLED: '1', DIRECT_DATABASE_URL: LOCAL_URL },
    });
    expect(result.ok).toBe(true);
  });

  it('allows 127.0.0.1', () => {
    const result = checkGuard({
      env: 'local',
      stagingConfirmToken: undefined,
      envRecord: {
        DEMO_SEED_ENABLED: '1',
        DIRECT_DATABASE_URL: 'postgresql://postgres:pass@127.0.0.1:5432/postgres',
      },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a staging host when --env=local', () => {
    const result = checkGuard({
      env: 'local',
      stagingConfirmToken: undefined,
      envRecord: { DEMO_SEED_ENABLED: '1', DIRECT_DATABASE_URL: STAGING_URL },
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
  });
});

describe('checkGuard — staging env', () => {
  it('allows staging host with correct confirm token', () => {
    const result = checkGuard({
      env: 'staging',
      stagingConfirmToken: 'my-secret',
      envRecord: {
        DEMO_SEED_ENABLED: '1',
        DIRECT_DATABASE_URL: STAGING_URL,
        DEMO_SEED_STAGING_CONFIRM: 'my-secret',
      },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects staging host with wrong confirm token', () => {
    const result = checkGuard({
      env: 'staging',
      stagingConfirmToken: 'wrong-token',
      envRecord: {
        DEMO_SEED_ENABLED: '1',
        DIRECT_DATABASE_URL: STAGING_URL,
        DEMO_SEED_STAGING_CONFIRM: 'my-secret',
      },
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('rejects staging when DEMO_SEED_STAGING_CONFIRM is not set', () => {
    const result = checkGuard({
      env: 'staging',
      stagingConfirmToken: 'my-secret',
      envRecord: {
        DEMO_SEED_ENABLED: '1',
        DIRECT_DATABASE_URL: STAGING_URL,
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects localhost when --env=staging', () => {
    const result = checkGuard({
      env: 'staging',
      stagingConfirmToken: 'my-secret',
      envRecord: {
        DEMO_SEED_ENABLED: '1',
        DIRECT_DATABASE_URL: LOCAL_URL,
        DEMO_SEED_STAGING_CONFIRM: 'my-secret',
      },
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
  });
});

describe('checkGuard — production denylist', () => {
  it('rejects prod direct URL with exit code 2', () => {
    const result = checkGuard({
      env: 'local',
      stagingConfirmToken: undefined,
      envRecord: { DEMO_SEED_ENABLED: '1', DIRECT_DATABASE_URL: PROD_URL },
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.reason).toMatch(/PRODUCTION/);
  });

  it('rejects prod pooler URL with exit code 2', () => {
    const result = checkGuard({
      env: 'staging',
      stagingConfirmToken: 'tok',
      envRecord: {
        DEMO_SEED_ENABLED: '1',
        DIRECT_DATABASE_URL: PROD_POOLER_URL,
        DEMO_SEED_STAGING_CONFIRM: 'tok',
      },
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
  });

  it('never leaks full URL in error message', () => {
    const result = checkGuard({
      env: 'local',
      stagingConfirmToken: undefined,
      envRecord: { DEMO_SEED_ENABLED: '1', DIRECT_DATABASE_URL: PROD_URL },
    });
    expect(result.reason).not.toMatch(PROD_URL);
  });
});

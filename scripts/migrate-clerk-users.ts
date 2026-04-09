/**
 * Phase 2d: Clerk → Better Auth User Migration Script
 *
 * Migrates existing Clerk users into Better Auth's `user` and `account` tables,
 * then updates the Supabase `users` table to replace Clerk IDs with Better Auth user IDs.
 *
 * Usage:
 *   tsx scripts/migrate-clerk-users.ts            # Run actual migration
 *   tsx scripts/migrate-clerk-users.ts --dry-run   # Preview what would happen
 *
 * Required env vars:
 *   CLERK_SECRET_KEY         - Clerk Backend API secret key
 *   DIRECT_DATABASE_URL      - Postgres connection string (same as Better Auth uses)
 *
 * IMPORTANT:
 *   - Users with Clerk passwords CANNOT be migrated directly (different hashing).
 *     They will need to use magic link or password reset on first login.
 *   - Google OAuth users get an `account` entry with providerId='google'.
 *   - Email/password users get an `account` entry with providerId='credential'.
 *   - Run with --dry-run first to verify the mapping before committing changes.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClerkEmailAddress {
  id: string;
  email_address: string;
  verification: {
    status: string;
    strategy: string;
  } | null;
}

interface ClerkExternalAccount {
  id: string;
  provider: string;
  provider_user_id: string; // e.g. Google sub ID
  email_address: string;
}

interface ClerkUser {
  id: string; // e.g. "user_2x..."
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  image_url: string | null;
  external_accounts: ClerkExternalAccount[];
  phone_numbers: Array<{ phone_number: string }>;
  password_enabled: boolean;
  created_at: number; // epoch ms
  updated_at: number; // epoch ms
}

interface MigrationResult {
  clerkId: string;
  email: string;
  betterAuthId: string;
  accountsCreated: string[];
  supabaseUserUpdated: boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const CLERK_API_BASE = 'https://api.clerk.com/v1';
const CLERK_PAGE_SIZE = 100; // Clerk max per page

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

function buildName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ') || 'Unknown';
}

function getPrimaryEmail(user: ClerkUser): string {
  const primary = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id
  );
  return primary?.email_address ?? user.email_addresses[0]?.email_address ?? '';
}

function isEmailVerified(user: ClerkUser): boolean {
  const primary = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id
  );
  return primary?.verification?.status === 'verified';
}

// ---------------------------------------------------------------------------
// Clerk API
// ---------------------------------------------------------------------------

async function fetchAllClerkUsers(secretKey: string): Promise<ClerkUser[]> {
  const allUsers: ClerkUser[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${CLERK_API_BASE}/users?limit=${CLERK_PAGE_SIZE}&offset=${offset}&order_by=-created_at`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Clerk API error (${res.status}): ${body}`);
    }

    const users: ClerkUser[] = await res.json();
    allUsers.push(...users);

    if (users.length < CLERK_PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += CLERK_PAGE_SIZE;
    }
  }

  return allUsers;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function migrateUsers() {
  console.log('='.repeat(60));
  console.log(DRY_RUN
    ? '  DRY RUN — No changes will be made'
    : '  LIVE MIGRATION — Changes will be committed to the database');
  console.log('='.repeat(60));
  console.log();

  // Validate env vars
  const clerkSecretKey = getRequiredEnv('CLERK_SECRET_KEY');
  const databaseUrl = getRequiredEnv('DIRECT_DATABASE_URL');

  // Connect to Postgres (same pool approach as Better Auth)
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Step 1: Fetch all users from Clerk
    console.log('[Step 1] Fetching users from Clerk...');
    const clerkUsers = await fetchAllClerkUsers(clerkSecretKey);
    console.log(`  Found ${clerkUsers.length} Clerk user(s)\n`);

    if (clerkUsers.length === 0) {
      console.log('No users to migrate. Exiting.');
      return;
    }

    // Step 2: Check existing Better Auth users to avoid duplicates
    console.log('[Step 2] Checking for existing Better Auth users...');
    const existingBAUsers = await pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM "user"'
    );
    const existingBAEmails = new Set(existingBAUsers.rows.map((r) => r.email.toLowerCase()));
    console.log(`  Found ${existingBAUsers.rows.length} existing Better Auth user(s)\n`);

    // Step 3: Check existing Supabase users for clerk_id mapping
    console.log('[Step 3] Fetching existing Supabase users...');
    const existingSBUsers = await pool.query<{ id: string; clerk_id: string; email: string; org_id: string }>(
      'SELECT id, clerk_id, email, org_id FROM users WHERE deleted_at IS NULL'
    );
    const sbUserByClerkId = new Map(
      existingSBUsers.rows.map((r) => [r.clerk_id, r])
    );
    console.log(`  Found ${existingSBUsers.rows.length} Supabase user(s)\n`);

    // Step 4: Migrate each user
    console.log('[Step 4] Migrating users...\n');
    const results: MigrationResult[] = [];
    const skipped: Array<{ clerkId: string; email: string; reason: string }> = [];
    const errors: Array<{ clerkId: string; email: string; error: string }> = [];

    for (const clerkUser of clerkUsers) {
      const email = getPrimaryEmail(clerkUser);
      const name = buildName(clerkUser.first_name, clerkUser.last_name);

      // Skip users without email
      if (!email) {
        skipped.push({
          clerkId: clerkUser.id,
          email: '(none)',
          reason: 'No email address',
        });
        continue;
      }

      // Skip if already migrated (Better Auth user with same email exists)
      if (existingBAEmails.has(email.toLowerCase())) {
        skipped.push({
          clerkId: clerkUser.id,
          email,
          reason: 'Better Auth user already exists with this email',
        });
        continue;
      }

      // Generate a new Better Auth user ID
      const betterAuthUserId = crypto.randomUUID();
      const now = new Date().toISOString();
      const emailVerified = isEmailVerified(clerkUser);
      const createdAt = new Date(clerkUser.created_at).toISOString();
      const updatedAt = new Date(clerkUser.updated_at).toISOString();
      const phone = clerkUser.phone_numbers?.[0]?.phone_number || null;

      const accountsCreated: string[] = [];

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create Better Auth user:`);
        console.log(`    ID:    ${betterAuthUserId}`);
        console.log(`    Name:  ${name}`);
        console.log(`    Email: ${email}`);
        console.log(`    Verified: ${emailVerified}`);
        console.log(`    Clerk ID: ${clerkUser.id}`);

        // Check for Google OAuth
        const googleAccount = clerkUser.external_accounts.find(
          (ea) => ea.provider === 'google'
        );
        if (googleAccount) {
          console.log(`    Would create Google account (sub: ${googleAccount.provider_user_id})`);
          accountsCreated.push('google');
        }

        // Check for password
        if (clerkUser.password_enabled) {
          console.log(`    Would create credential account (password NOT migrated — user must reset)`);
          accountsCreated.push('credential');
        }

        // Check Supabase user
        const sbUser = sbUserByClerkId.get(clerkUser.id);
        if (sbUser) {
          console.log(`    Would update Supabase users.clerk_id: ${clerkUser.id} → ${betterAuthUserId}`);
        } else {
          console.log(`    ⚠ No matching Supabase user found for clerk_id=${clerkUser.id}`);
        }

        console.log();

        results.push({
          clerkId: clerkUser.id,
          email,
          betterAuthId: betterAuthUserId,
          accountsCreated,
          supabaseUserUpdated: !!sbUser,
        });
        continue;
      }

      // LIVE MIGRATION — Use a transaction for atomicity
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 4a: Insert into Better Auth "user" table
        await client.query(
          `INSERT INTO "user" (id, name, email, "emailVerified", image, phone, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            betterAuthUserId,
            name,
            email,
            emailVerified,
            clerkUser.image_url || null,
            phone,
            createdAt,
            updatedAt,
          ]
        );

        // 4b: Create account entries
        // Google OAuth
        const googleAccount = clerkUser.external_accounts.find(
          (ea) => ea.provider === 'google'
        );
        if (googleAccount) {
          await client.query(
            `INSERT INTO "account" (id, "userId", "accountId", "providerId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              crypto.randomUUID(),
              betterAuthUserId,
              googleAccount.provider_user_id,
              'google',
              now,
              now,
            ]
          );
          accountsCreated.push('google');
        }

        // Email/password (credential) — create account entry but no password hash
        if (clerkUser.password_enabled) {
          await client.query(
            `INSERT INTO "account" (id, "userId", "accountId", "providerId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              crypto.randomUUID(),
              betterAuthUserId,
              betterAuthUserId, // accountId = userId for credential accounts
              'credential',
              now,
              now,
            ]
          );
          accountsCreated.push('credential');
        }

        // If user has neither OAuth nor password, create a credential account
        // so they can use magic link to sign in
        if (!googleAccount && !clerkUser.password_enabled) {
          await client.query(
            `INSERT INTO "account" (id, "userId", "accountId", "providerId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              crypto.randomUUID(),
              betterAuthUserId,
              betterAuthUserId,
              'credential',
              now,
              now,
            ]
          );
          accountsCreated.push('credential (magic-link fallback)');
        }

        // 4c: Update existing Supabase users table
        const sbUser = sbUserByClerkId.get(clerkUser.id);
        let supabaseUpdated = false;
        if (sbUser) {
          const updateResult = await client.query(
            `UPDATE users SET clerk_id = $1, updated_at = NOW() WHERE clerk_id = $2`,
            [betterAuthUserId, clerkUser.id]
          );
          supabaseUpdated = (updateResult.rowCount ?? 0) > 0;
        }

        await client.query('COMMIT');

        console.log(`  ✓ Migrated: ${email} (${clerkUser.id} → ${betterAuthUserId})`);
        if (accountsCreated.length > 0) {
          console.log(`    Accounts: ${accountsCreated.join(', ')}`);
        }
        if (!sbUser) {
          console.log(`    ⚠ No matching Supabase user — clerk_id not updated`);
        }

        results.push({
          clerkId: clerkUser.id,
          email,
          betterAuthId: betterAuthUserId,
          accountsCreated,
          supabaseUserUpdated: supabaseUpdated,
        });
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed: ${email} (${clerkUser.id}): ${err.message}`);
        errors.push({
          clerkId: clerkUser.id,
          email,
          error: err.message,
        });
      } finally {
        client.release();
      }
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('  Migration Summary');
    console.log('='.repeat(60));
    console.log(`  Total Clerk users:     ${clerkUsers.length}`);
    console.log(`  Migrated:              ${results.length}`);
    console.log(`  Skipped:               ${skipped.length}`);
    console.log(`  Errors:                ${errors.length}`);
    console.log();

    if (skipped.length > 0) {
      console.log('  Skipped users:');
      for (const s of skipped) {
        console.log(`    - ${s.email} (${s.clerkId}): ${s.reason}`);
      }
      console.log();
    }

    if (errors.length > 0) {
      console.log('  Failed users:');
      for (const e of errors) {
        console.log(`    - ${e.email} (${e.clerkId}): ${e.error}`);
      }
      console.log();
    }

    const passwordUsers = results.filter((r) =>
      r.accountsCreated.includes('credential')
    );
    if (passwordUsers.length > 0) {
      console.log('  ⚠ Password Note:');
      console.log(`    ${passwordUsers.length} user(s) had Clerk passwords that could NOT be migrated.`);
      console.log('    These users will need to sign in via:');
      console.log('      1. Magic link (email-based passwordless login)');
      console.log('      2. Password reset flow to set a new password');
      console.log('      3. Google OAuth (if they had a linked Google account)');
      console.log();
    }

    if (DRY_RUN) {
      console.log('  This was a DRY RUN. No changes were made.');
      console.log('  Run without --dry-run to perform the actual migration.');
    } else {
      console.log('  Migration complete. Verify by checking:');
      console.log('    SELECT count(*) FROM "user";');
      console.log('    SELECT count(*) FROM "account";');
      console.log('    SELECT clerk_id FROM users LIMIT 10;');
    }
    console.log();
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

migrateUsers().catch((err) => {
  console.error('\nFatal error during migration:', err);
  process.exit(1);
});

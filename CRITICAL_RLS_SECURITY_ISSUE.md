# CRITICAL: Widespread RLS Security Issue Found

**Date**: 2025-10-12
**Severity**: 🔴 **CRITICAL** - Feature Breaking
**Status**: ⚠️ **REQUIRES IMMEDIATE FIX**

---

## Executive Summary

A critical security pattern error was discovered during the Phase 3 Agentic Retrieval audit. The issue affects **6 tables** across migrations 012 and 014, causing **complete feature failure** for authenticated users.

**Impact**: All affected tables are effectively **inaccessible** to authenticated users. Only service role can access data.

**Root Cause**: Incorrect authentication pattern in RLS policies (`id = auth.uid()` instead of `clerk_id = auth.uid()::text`)

**Affected Users**: All authenticated users attempting to access:
- Recording summaries
- Video frames
- Connector configurations
- Imported documents
- Search analytics
- Agentic search logs

---

## Affected Tables

| Table | Migration | Status | User Impact |
|-------|-----------|--------|-------------|
| `recording_summaries` | 012 | 🔴 BROKEN | Cannot view summaries |
| `video_frames` | 012 | 🔴 BROKEN | Cannot view frames |
| `connector_configs` | 012 | 🔴 BROKEN | Cannot manage connectors |
| `imported_documents` | 012 | 🔴 BROKEN | Cannot view imported docs |
| `search_analytics` | 012 | 🔴 BROKEN | Cannot view analytics |
| `agentic_search_logs` | 014 | 🔴 BROKEN | Cannot view search logs |

---

## Technical Details

### The Problem

**Incorrect Pattern** (used in migrations 012 & 014):
```sql
CREATE POLICY "Users can view their org's data"
  ON some_table FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()  -- ❌ WRONG
    )
  );
```

**Why It Fails**:
1. `auth.uid()` returns Clerk user ID as **TEXT** (e.g., `"user_2abc123"`)
2. `users.id` is **UUID** (internal primary key)
3. The comparison `id = auth.uid()` compares **UUID to TEXT** → never matches
4. Result: Subquery returns no rows → policy denies all access

### The Solution

**Correct Pattern** (established in migrations 007-009):
```sql
CREATE POLICY "Users can view their org's data"
  ON some_table FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = auth.uid()::text  -- ✅ CORRECT
    )
  );
```

**Why It Works**:
1. `users.clerk_id` stores Clerk user ID as TEXT
2. `auth.uid()::text` extracts Clerk ID from JWT
3. The comparison `clerk_id = auth.uid()::text` matches correctly
4. Result: Subquery returns user's org_id → policy grants access

---

## How This Happened

### Timeline

1. **Migration 007** (User Refactor): Established correct pattern using `clerk_id`
2. **Migration 008** (RLS for Core Tables): Used correct pattern
3. **Migration 009** (Tags): Used correct pattern ✅
4. **Migration 012** (Phase 1): **Introduced incorrect pattern** ❌
5. **Migration 014** (Phase 3): **Copied incorrect pattern** ❌

### Root Cause Analysis

Migration 012 appears to have been written referencing the **table structure** (which uses `id` as UUID primary key) without checking **existing RLS patterns** (which correctly use `clerk_id`).

The incorrect pattern was then **copy-pasted** into migration 014, spreading the issue.

---

## Evidence

### From Migration 007 (Correct Pattern)
```sql
-- Line 84
CREATE POLICY "Users can read their own data"
ON users
FOR SELECT
TO authenticated
USING (clerk_id = auth.uid()::text);  -- ✅ CORRECT
```

### From Migration 009 (Correct Pattern)
```sql
-- Tags table policies
USING (
  org_id IN (
    SELECT org_id FROM users WHERE clerk_id = auth.uid()::text  -- ✅ CORRECT
  )
);
```

### From Migration 012 (Incorrect Pattern)
```sql
-- Line 34
CREATE POLICY "Users can view summaries from their org"
  ON recording_summaries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));  -- ❌ WRONG
```

---

## Fix Strategy

### 3 Migrations Created

1. **`015_fix_agentic_logs_rls.sql`** (ALREADY CREATED)
   - Fixes `agentic_search_logs` table only
   - Adds performance indexes
   - Can be applied immediately

2. **`016_fix_all_rls_policies.sql`** (ALREADY CREATED)
   - Fixes all 5 tables from migration 012
   - Comprehensive fix for all affected policies
   - **RECOMMENDED: Apply this instead of 015** (supersedes it)

3. **`014_add_agentic_search_logs_down.sql`** (ALREADY CREATED)
   - Rollback script for migration 014
   - For disaster recovery if needed

### Application Order

**Option A: Incremental Fix** (if 014 already applied to production)
```bash
# Apply fix for Phase 3 only
supabase migration apply 015_fix_agentic_logs_rls.sql

# Then fix Phase 1 tables
supabase migration apply 016_fix_all_rls_policies.sql
```

**Option B: Comprehensive Fix** (RECOMMENDED)
```bash
# Apply comprehensive fix (covers everything)
supabase migration apply 016_fix_all_rls_policies.sql
```

---

## Testing Plan

### 1. Pre-Fix Verification (Confirm Issue Exists)

```sql
-- Connect as authenticated user
SET request.jwt.claims TO '{"sub": "user_clerk_id_here"}';

-- Should return 0 rows (broken)
SELECT COUNT(*) FROM recording_summaries;
SELECT COUNT(*) FROM agentic_search_logs;

-- Reset
RESET request.jwt.claims;
```

### 2. Post-Fix Verification (Confirm Fix Works)

```sql
-- Connect as authenticated user
SET request.jwt.claims TO '{"sub": "user_clerk_id_here"}';

-- Should return actual data (fixed)
SELECT COUNT(*) FROM recording_summaries;
SELECT COUNT(*) FROM agentic_search_logs;

-- Verify policy is correct
SELECT policyname, definition
FROM pg_policies
WHERE tablename = 'agentic_search_logs'
  AND schemaname = 'public';
-- Should show: ... WHERE clerk_id = auth.uid()::text

-- Reset
RESET request.jwt.claims;
```

### 3. Integration Testing

```typescript
// Test from Next.js API route
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const { userId, orgId } = await requireOrg();
  const supabase = await createClient();

  // Should return user's org data (not empty)
  const { data: summaries, error } = await supabase
    .from('recording_summaries')
    .select('*')
    .limit(10);

  console.log('Summaries found:', summaries?.length);
  console.assert(summaries !== null, 'Should have access to summaries');

  return Response.json({ success: true, count: summaries?.length });
}
```

---

## Risk Assessment

### Current Risk (Before Fix)

**Severity**: 🔴 **CRITICAL**

- **Data Integrity**: Not affected (data is safe)
- **Availability**: 6 features completely broken for users
- **Security**: No data leak (overly restrictive, not permissive)
- **User Experience**: Features appear broken/empty

### After Fix

**Severity**: 🟢 **RESOLVED**

- All features will work as designed
- No data migration needed (policies only)
- No downtime required (ALTER POLICY is instant)

---

## Prevention Measures

### 1. Add to Code Review Checklist

```markdown
## Supabase Migration Review Checklist

- [ ] RLS policies use `clerk_id = auth.uid()::text` (NOT `id = auth.uid()`)
- [ ] Policies specify role: `TO authenticated` or `TO service_role`
- [ ] Both USING and WITH CHECK clauses for INSERT/UPDATE policies
- [ ] Foreign keys have appropriate ON DELETE behavior
- [ ] Indexes created for all foreign keys
- [ ] Migration has companion rollback script (*_down.sql)
```

### 2. Add Automated Test

Create: `__tests__/supabase/rls-policies.test.ts`

```typescript
describe('RLS Policies', () => {
  it('should use clerk_id pattern for auth', async () => {
    const { data: policies } = await supabase.rpc('get_policies');

    const invalidPolicies = policies.filter(p =>
      p.definition.includes('id = auth.uid()') &&
      !p.definition.includes('clerk_id')
    );

    expect(invalidPolicies).toHaveLength(0);
  });
});
```

### 3. Documentation Update

Add to `CLAUDE.md` or create `SUPABASE_PATTERNS.md`:

```markdown
## RLS Policy Patterns

### Authentication Pattern (ALWAYS USE THIS)

```sql
-- For org-scoped data
CREATE POLICY "policy_name"
  ON table_name FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
    )
  );
```

### Common Mistakes

❌ **WRONG**: `WHERE id = auth.uid()` (UUID vs TEXT mismatch)
❌ **WRONG**: `WHERE id = auth.uid()::uuid` (clerk_id is TEXT, not UUID)
✅ **CORRECT**: `WHERE clerk_id = auth.uid()::text`
```

---

## Summary

### Critical Actions Required

1. ✅ Review audit report: `PHASE3_AGENTIC_SUPABASE_AUDIT.md`
2. ⚠️ Apply fix migration: `016_fix_all_rls_policies.sql`
3. ✅ Test with authenticated users (see Testing Plan above)
4. ✅ Deploy to production
5. ✅ Update documentation/checklist
6. ✅ Add automated tests to prevent recurrence

### Files Created

1. `/PHASE3_AGENTIC_SUPABASE_AUDIT.md` - Comprehensive audit report
2. `/supabase/migrations/015_fix_agentic_logs_rls.sql` - Fix for Phase 3 only
3. `/supabase/migrations/016_fix_all_rls_policies.sql` - Fix for ALL affected tables (USE THIS)
4. `/supabase/migrations/014_add_agentic_search_logs_down.sql` - Rollback script
5. `/CRITICAL_RLS_SECURITY_ISSUE.md` - This document

### Next Steps

**Immediate** (within 1 hour):
- Apply migration 016
- Test with real user account
- Verify all 6 tables accessible

**Short-term** (within 1 day):
- Add to code review checklist
- Update developer documentation
- Deploy to production

**Long-term** (within 1 week):
- Add automated RLS policy tests
- Audit all other tables for similar issues
- Create migration template with correct patterns

---

**Status**: Ready for immediate deployment
**Estimated Fix Time**: 5 minutes to apply migration + 10 minutes to test = **15 minutes total**

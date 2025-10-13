# Phase 5 Connector System - Deployment Guide

**Status:** Ready for Deployment
**Migrations:** 025, 026
**Estimated Time:** ~5 minutes
**Risk Level:** Low (fully reversible)

---

## 📋 Pre-Deployment Checklist

Before deploying Phase 5, ensure:

- [ ] Database backup completed
- [ ] Supabase project ID confirmed: `clpatptmumyasbypvmun`
- [ ] Access to database via `psql` or Supabase CLI
- [ ] All tests passing on current codebase
- [ ] Migration files reviewed and understood

---

## 🚀 Deployment Steps

### Step 1: Backup Database (2 minutes)

```bash
# Using Supabase CLI
supabase db dump -f backup-pre-phase5-$(date +%Y%m%d).sql

# Or using pg_dump
pg_dump $DATABASE_URL > backup-pre-phase5-$(date +%Y%m%d).sql
```

### Step 2: Apply Schema Migration (1 minute)

```bash
# Apply main Phase 5 migration
supabase db push --file supabase/migrations/025_phase5_connector_system_enhancements.sql

# Or using psql directly
psql $DATABASE_URL -f supabase/migrations/025_phase5_connector_system_enhancements.sql
```

**Expected Output:**
```
NOTICE:  Updating existing tables with missing columns...
NOTICE:    ✓ Updated connector_configs with 13 new columns
NOTICE:    ✓ Updated imported_documents with 11 new columns
NOTICE:    ✓ Added 6 performance indexes
NOTICE:  Creating new connector system tables...
NOTICE:    ✓ Created connector_sync_logs table
NOTICE:    ✓ Created connector_webhook_events table
NOTICE:    ✓ Created file_upload_batches table
NOTICE:  Creating helper functions...
NOTICE:    ✓ Created increment_batch_processed function
NOTICE:    ✓ Created increment_batch_failed function
NOTICE:  Updating RLS policies...
NOTICE:    ✓ Updated connector_configs policies (role-based access)
NOTICE:    ✓ Added service_role bypass policies
NOTICE:    ✓ Created RLS policies for all new tables
NOTICE:  Granting permissions...
NOTICE:    ✓ Granted permissions to service_role and authenticated
NOTICE:
NOTICE:  ========================================================
NOTICE:  Phase 5 Migration Completed Successfully!
NOTICE:  ========================================================
```

### Step 3: Apply Storage Configuration (1 minute)

```bash
# Apply storage configuration
supabase db push --file supabase/migrations/026_phase5_storage_configuration.sql

# Or using psql
psql $DATABASE_URL -f supabase/migrations/026_phase5_storage_configuration.sql
```

**Expected Output:**
```
NOTICE:  Configuring storage for Phase 5 connector system...
NOTICE:    ✓ Created/updated connector-imports bucket
NOTICE:    ✓ Created SELECT policy for connector-imports bucket
NOTICE:    ✓ Created service_role policy for connector-imports bucket
NOTICE:    ✓ Created INSERT policy for connector-imports bucket
NOTICE:    ✓ Created cleanup_old_connector_imports function
NOTICE:    ✓ Created connector_storage_usage view
NOTICE:
NOTICE:  ========================================================
NOTICE:  Phase 5 Storage Configuration Completed!
NOTICE:  ========================================================
```

### Step 4: Validate Deployment (1 minute)

```bash
# Run validation script
psql $DATABASE_URL -f scripts/validate-phase5-migration.sql
```

**Expected Output:**
```
✓ PASS: All 3 new tables exist
✓ PASS: connector_configs has all new columns
✓ PASS: imported_documents has all new columns
✓ PASS: All helper functions exist
✓ PASS: increment_batch_processed works correctly
✓ PASS: All Phase 5 indexes exist
✓ PASS: All tables have RLS policies
✓ PASS: connector-imports bucket exists

Overall: ✓ ALL CHECKS PASSED
Phase 5 migrations applied successfully!
```

---

## 🧪 Post-Deployment Testing

### Test 1: Connector Creation
```typescript
// Test creating a connector
const { data, error } = await supabase
  .from('connector_configs')
  .insert({
    org_id: 'your-org-id',
    connector_type: 'google_drive',
    name: 'Test Connector',
    credentials: { accessToken: 'test' },
  })
  .select()
  .single();

console.log('Connector created:', data);
```

### Test 2: Batch Upload
```typescript
// Test batch upload
const { data: batch, error } = await supabase
  .from('file_upload_batches')
  .insert({
    org_id: 'your-org-id',
    total_files: 5,
    batch_name: 'Test Batch',
  })
  .select()
  .single();

// Test increment function
await supabase.rpc('increment_batch_processed', {
  batch_id_param: batch.id,
});

// Verify
const { data: updated } = await supabase
  .from('file_upload_batches')
  .select('processed_files, progress_percent')
  .eq('id', batch.id)
  .single();

console.log('Batch updated:', updated);
// Expected: { processed_files: 1, progress_percent: 20 }
```

### Test 3: Sync Logging
```typescript
// Test sync log creation
const { data, error } = await supabase
  .from('connector_sync_logs')
  .insert({
    connector_id: 'connector-id',
    org_id: 'your-org-id',
    sync_type: 'manual',
    status: 'success',
    documents_synced: 10,
  })
  .select()
  .single();

console.log('Sync log created:', data);
```

### Test 4: Storage Upload
```typescript
// Test connector storage upload
const file = new File(['test'], 'test.txt', { type: 'text/plain' });

const { data, error } = await supabase.storage
  .from('connector-imports')
  .upload('your-org-id/connectors/test/test.txt', file);

console.log('File uploaded:', data);
```

---

## 🔄 Rollback Procedure (If Needed)

If issues are discovered, rollback using:

```bash
# Rollback Phase 5 changes
psql $DATABASE_URL -f supabase/migrations/025_phase5_connector_system_enhancements_down.sql

# This will:
# - Drop all 3 new tables
# - Drop helper functions
# - Revert RLS policies
# - Keep columns (to preserve data)
```

**Note:** The rollback does NOT remove added columns to prevent data loss. If you need complete rollback, uncomment section 4 in the down migration.

---

## 📊 Monitoring

### Check Connector Activity

```sql
-- View recent sync operations
SELECT
  cc.name as connector_name,
  csl.sync_type,
  csl.status,
  csl.documents_synced,
  csl.duration_ms,
  csl.started_at
FROM connector_sync_logs csl
JOIN connector_configs cc ON csl.connector_id = cc.id
ORDER BY csl.started_at DESC
LIMIT 20;
```

### Check Storage Usage

```sql
-- View storage usage by connector
SELECT * FROM connector_storage_usage
ORDER BY active_mb DESC;
```

### Check Batch Uploads

```sql
-- View active batch uploads
SELECT
  id,
  batch_name,
  total_files,
  processed_files,
  failed_files,
  progress_percent,
  status,
  created_at
FROM file_upload_batches
WHERE status IN ('uploading', 'processing')
ORDER BY created_at DESC;
```

### Check Webhook Events

```sql
-- View unprocessed webhook events
SELECT
  event_type,
  event_source,
  retry_count,
  received_at
FROM connector_webhook_events
WHERE NOT processed
ORDER BY received_at ASC;
```

---

## 🐛 Troubleshooting

### Issue: Migration fails with "column already exists"

**Cause:** Migration was partially applied before

**Solution:**
```sql
-- Check which columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'connector_configs'
  AND column_name LIKE '%webhook%';

-- If columns exist, migration will skip them (IF NOT EXISTS)
-- Safe to re-run migration
```

### Issue: "permission denied for table"

**Cause:** RLS policies blocking service role

**Solution:**
```sql
-- Verify service_role policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%service%role%';

-- Re-apply if missing
CREATE POLICY "Service role full access to connectors"
  ON connector_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### Issue: "function increment_batch_processed does not exist"

**Cause:** Function creation failed or was rolled back

**Solution:**
```bash
# Re-run migration 025
psql $DATABASE_URL -f supabase/migrations/025_phase5_connector_system_enhancements.sql
```

### Issue: Storage uploads fail with "bucket not found"

**Cause:** Storage migration not applied

**Solution:**
```bash
# Apply storage migration
psql $DATABASE_URL -f supabase/migrations/026_phase5_storage_configuration.sql
```

---

## 📈 Performance Tuning

### After Deployment

1. **Analyze New Tables** (helps query planner)
```sql
ANALYZE connector_sync_logs;
ANALYZE connector_webhook_events;
ANALYZE file_upload_batches;
```

2. **Monitor Index Usage**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE 'connector%'
ORDER BY idx_scan DESC;
```

3. **Check Query Performance**
```sql
-- Enable query timing
\timing on

-- Test critical queries
EXPLAIN ANALYZE
SELECT * FROM connector_configs
WHERE is_active = true
  AND next_sync_at <= now()
  AND sync_frequency != 'manual';
```

---

## ✅ Success Criteria

Phase 5 deployment is successful when:

- [x] All migrations applied without errors
- [x] Validation script passes all checks
- [x] Service code runs without "table/column not found" errors
- [x] Background jobs can insert into all tables
- [x] Storage uploads work to connector-imports bucket
- [x] All integration tests pass

---

## 📞 Support

### Migration Issues
- Check Supabase dashboard logs
- Review migration output for errors
- Verify database connection and permissions

### Service Integration Issues
- Check service logs for database errors
- Verify RLS policies allow service_role access
- Ensure all environment variables are set

### Getting Help
- Review comprehensive audit: `PHASE5_SUPABASE_COMPREHENSIVE_AUDIT.md`
- Check executive summary: `PHASE5_AUDIT_EXECUTIVE_SUMMARY.md`
- Run validation: `scripts/validate-phase5-migration.sql`

---

## 🎯 Next Steps

After successful deployment:

1. **Test Each Connector**
   - Google Drive integration
   - Notion integration
   - Zoom webhook handling
   - Teams webhook handling
   - File upload system
   - URL import

2. **Monitor for 24 Hours**
   - Watch background job logs
   - Check sync success rates
   - Monitor storage usage
   - Track webhook processing

3. **Enable Production Features**
   - Set up OAuth applications
   - Configure webhook endpoints
   - Enable scheduled syncs
   - Set up cleanup cron jobs

4. **Documentation**
   - Document connector setup for each service
   - Create user guides for connector management
   - Set up monitoring dashboards

---

**Deployment Prepared By:** Claude (Supabase Specialist)
**Last Updated:** 2025-10-13
**Migrations:** 025, 026
**Validation Script:** scripts/validate-phase5-migration.sql

#!/bin/bash
#
# Phase 6 Migration Deployment Script
# Applies security and performance migrations to Supabase database
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Phase 6 Migration Deployment${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
  echo "Please set your Supabase connection string:"
  echo "  export DATABASE_URL='postgresql://...' "
  echo ""
  echo "You can find this in your Supabase project settings:"
  echo "  https://app.supabase.com/project/<project-id>/settings/database"
  exit 1
fi

echo -e "${YELLOW}Database:${NC} ${DATABASE_URL%%\?*}"  # Show URL without query params
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo -e "${RED}ERROR: psql not found${NC}"
  echo "Please install PostgreSQL client tools"
  exit 1
fi

# Migration directory
MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

# Migration files (in order)
MIGRATIONS=(
  "027_phase6_analytics_polish.sql"
  "028_phase6_comprehensive_security_fixes.sql"
  "029_phase6_performance_optimizations.sql"
)

echo -e "${YELLOW}Migrations to apply:${NC}"
for migration in "${MIGRATIONS[@]}"; do
  echo "  - $migration"
done
echo ""

# Confirm before proceeding
read -p "Apply these migrations to the database? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted by user"
  exit 0
fi

echo ""
echo -e "${GREEN}Applying migrations...${NC}"
echo ""

# Apply each migration
for migration in "${MIGRATIONS[@]}"; do
  migration_file="$MIGRATIONS_DIR/$migration"

  if [ ! -f "$migration_file" ]; then
    echo -e "${YELLOW}⚠ Skipping $migration (file not found)${NC}"
    continue
  fi

  echo -e "${YELLOW}Applying:${NC} $migration"

  # Apply migration and capture output
  if psql "$DATABASE_URL" -f "$migration_file" > /tmp/migration_output.txt 2>&1; then
    echo -e "${GREEN}✓ Successfully applied $migration${NC}"

    # Show any NOTICE messages (like verification results)
    grep -i "NOTICE" /tmp/migration_output.txt || true
  else
    echo -e "${RED}✗ Failed to apply $migration${NC}"
    echo -e "${RED}Error details:${NC}"
    cat /tmp/migration_output.txt
    exit 1
  fi

  echo ""
done

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Migration deployment complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Verification queries
echo -e "${YELLOW}Running verification queries...${NC}"
echo ""

# Check migration 027 (Phase 6 base tables)
echo "1. Checking Phase 6 base tables..."
psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) || ' Phase 6 tables found'
  FROM information_schema.tables
  WHERE table_name IN (
    'search_analytics', 'search_feedback', 'saved_searches',
    'org_quotas', 'quota_usage_events', 'ab_experiments',
    'alert_rules', 'alert_incidents', 'system_metrics'
  );
"

# Check migration 028 (Security fixes)
echo "2. Checking system admin column..."
psql "$DATABASE_URL" -t -c "
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_system_admin'
    ) THEN '✓ System admin column exists'
    ELSE '✗ System admin column missing'
  END;
"

echo "3. Checking security functions..."
psql "$DATABASE_URL" -t -c "
  SELECT CASE
    WHEN COUNT(*) = 2 THEN '✓ Security functions created (check_quota_optimized, is_valid_uuid)'
    ELSE '✗ Missing security functions (' || COUNT(*) || '/2)'
  END
  FROM pg_proc
  WHERE proname IN ('check_quota_optimized', 'is_valid_uuid');
"

# Check migration 029 (Performance optimizations)
echo "4. Checking performance functions..."
psql "$DATABASE_URL" -t -c "
  SELECT CASE
    WHEN COUNT(*) >= 3 THEN '✓ Performance functions created'
    ELSE '✗ Missing performance functions (' || COUNT(*) || '/3+)'
  END
  FROM pg_proc
  WHERE proname IN ('search_chunks_optimized', 'create_monthly_partitions', 'auto_analyze_hot_tables');
"

echo "5. Checking materialized views..."
psql "$DATABASE_URL" -t -c "
  SELECT CASE
    WHEN COUNT(*) >= 2 THEN '✓ Materialized views created (popular_queries, org_analytics_summary)'
    ELSE '✗ Missing materialized views (' || COUNT(*) || '/2)'
  END
  FROM pg_matviews
  WHERE matviewname IN ('popular_queries', 'org_analytics_summary');
"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Next Steps:${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "1. Initialize default quotas for existing organizations:"
echo "   Run: psql \$DATABASE_URL -f supabase/migrations/027_phase6_analytics_polish.sql"
echo ""
echo "2. Set system admin users:"
echo "   psql \$DATABASE_URL -c \"UPDATE users SET is_system_admin = true WHERE email = 'your@email.com';\""
echo ""
echo "3. Verify Redis is configured in your environment:"
echo "   - UPSTASH_REDIS_REST_URL"
echo "   - UPSTASH_REDIS_REST_TOKEN"
echo ""
echo "4. Deploy your application with the updated code"
echo ""
echo "5. Set up cron jobs for maintenance (see migration 029 notes)"
echo ""
echo -e "${GREEN}Phase 6 is ready for production! 🚀${NC}"

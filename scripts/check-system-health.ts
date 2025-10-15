/**
 * System Health Check
 *
 * Quick diagnostic script to verify all components of the processing pipeline
 * are properly configured and functioning.
 *
 * Usage:
 *   yarn tsx scripts/check-system-health.ts
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getGoogleAI } from '@/lib/google/client';

// Color helpers
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function check(name: string, status: 'pass' | 'fail' | 'warn', message?: string) {
  const emoji = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
  const color = status === 'pass' ? c.green : status === 'fail' ? c.red : c.yellow;
  console.log(`${color}${emoji} ${name}${c.reset}${message ? ` - ${message}` : ''}`);
}

function section(title: string) {
  console.log(`\n${c.blue}${'='.repeat(60)}${c.reset}`);
  console.log(`${c.blue}${title}${c.reset}`);
  console.log(`${c.blue}${'='.repeat(60)}${c.reset}\n`);
}

async function main() {
  console.log(`${c.blue}╔${'═'.repeat(58)}╗${c.reset}`);
  console.log(`${c.blue}║${' '.repeat(15)}SYSTEM HEALTH CHECK${' '.repeat(23)}║${c.reset}`);
  console.log(`${c.blue}╚${'═'.repeat(58)}╝${c.reset}`);

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  let warnings = 0;

  // 1. Environment Variables
  section('1. Environment Variables');

  const envVars = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true },
    { name: 'GOOGLE_AI_API_KEY', required: true },
    { name: 'GOOGLE_GENERATIVE_AI_API_KEY', required: false },
    { name: 'GOOGLE_APPLICATION_CREDENTIALS', required: false },
    { name: 'CLERK_SECRET_KEY', required: true },
    { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', required: true },
  ];

  for (const { name, required } of envVars) {
    totalChecks++;
    const exists = !!process.env[name];
    const value = process.env[name];

    if (exists) {
      const preview = value!.length > 20 ? value!.substring(0, 20) + '...' : value;
      check(name, 'pass', preview);
      passedChecks++;
    } else {
      if (required) {
        check(name, 'fail', 'Missing (required)');
        failedChecks++;
      } else {
        check(name, 'warn', 'Missing (optional)');
        warnings++;
      }
    }
  }

  // 2. Supabase Connection
  section('2. Supabase Connection');

  try {
    totalChecks++;
    const supabase = createAdminClient();
    const { error } = await supabase.from('organizations').select('id').limit(1);

    if (error) {
      check('Supabase connection', 'fail', error.message);
      failedChecks++;
    } else {
      check('Supabase connection', 'pass');
      passedChecks++;
    }

    // Check tables exist
    const tables = [
      'organizations',
      'users',
      'recordings',
      'transcripts',
      'documents',
      'transcript_chunks',
      'jobs',
    ];

    for (const table of tables) {
      totalChecks++;
      const { error: tableError } = await supabase.from(table).select('id').limit(1);

      if (tableError) {
        check(`Table: ${table}`, 'fail', tableError.message);
        failedChecks++;
      } else {
        check(`Table: ${table}`, 'pass');
        passedChecks++;
      }
    }
  } catch (error) {
    totalChecks++;
    check('Supabase connection', 'fail', error instanceof Error ? error.message : 'Unknown error');
    failedChecks++;
  }

  // 3. Google AI Connection
  section('3. Google AI Connection');

  try {
    totalChecks++;
    if (!process.env.GOOGLE_AI_API_KEY) {
      check('Google AI API key', 'fail', 'Not configured');
      failedChecks++;
    } else {
      const googleAI = getGoogleAI();
      const model = googleAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Try a simple test
      const result = await model.generateContent('Hello');
      const response = await result.response;
      const text = response.text();

      if (text && text.length > 0) {
        check('Google AI connection', 'pass', 'API responding');
        passedChecks++;
      } else {
        check('Google AI connection', 'warn', 'Empty response');
        warnings++;
      }
    }
  } catch (error) {
    totalChecks++;
    check('Google AI connection', 'fail', error instanceof Error ? error.message : 'Unknown error');
    failedChecks++;
  }

  // 4. Database Health
  section('4. Database Health');

  try {
    const supabase = createAdminClient();

    // Count pending jobs
    totalChecks++;
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id')
      .eq('status', 'pending');

    if (jobsError) {
      check('Pending jobs count', 'fail', jobsError.message);
      failedChecks++;
    } else {
      const count = pendingJobs?.length || 0;
      if (count > 100) {
        check('Pending jobs count', 'warn', `${count} jobs (queue backing up?)`);
        warnings++;
      } else {
        check('Pending jobs count', 'pass', `${count} jobs`);
        passedChecks++;
      }
    }

    // Count stuck jobs (processing > 10 minutes)
    totalChecks++;
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('jobs')
      .select('id, type, started_at')
      .eq('status', 'processing')
      .lt('started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (stuckError) {
      check('Stuck jobs', 'fail', stuckError.message);
      failedChecks++;
    } else {
      const count = stuckJobs?.length || 0;
      if (count > 0) {
        check('Stuck jobs (>10min)', 'warn', `${count} jobs stuck`);
        warnings++;
      } else {
        check('Stuck jobs (>10min)', 'pass', 'None');
        passedChecks++;
      }
    }

    // Recent recordings
    totalChecks++;
    const { data: recentRecordings, error: recError } = await supabase
      .from('recordings')
      .select('id, status')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recError) {
      check('Recent recordings', 'fail', recError.message);
      failedChecks++;
    } else {
      const count = recentRecordings?.length || 0;
      const completed = recentRecordings?.filter((r) => r.status === 'completed').length || 0;
      check('Recent recordings', 'pass', `${count} total, ${completed} completed`);
      passedChecks++;
    }
  } catch (error) {
    totalChecks += 3;
    failedChecks += 3;
    check('Database health', 'fail', error instanceof Error ? error.message : 'Unknown error');
  }

  // 5. Job Handlers
  section('5. Job Handlers');

  const handlers = [
    { name: 'transcribe-gemini-video', path: '../lib/workers/handlers/transcribe-gemini-video' },
    { name: 'docify-google', path: '../lib/workers/handlers/docify-google' },
    { name: 'embeddings-google', path: '../lib/workers/handlers/embeddings-google' },
  ];

  for (const handler of handlers) {
    totalChecks++;
    try {
      const module = await import(handler.path);
      const hasExport = Object.keys(module).length > 0;

      if (hasExport) {
        check(`Handler: ${handler.name}`, 'pass');
        passedChecks++;
      } else {
        check(`Handler: ${handler.name}`, 'warn', 'No exports found');
        warnings++;
      }
    } catch (error) {
      check(`Handler: ${handler.name}`, 'fail', error instanceof Error ? error.message : 'Unknown');
      failedChecks++;
    }
  }

  // 6. Streaming Manager
  section('6. Streaming Manager');

  try {
    totalChecks++;
    const { streamingManager } = await import('../lib/services/streaming-processor');
    const connectionCount = streamingManager.getConnectionCount();

    check('Streaming manager', 'pass', `${connectionCount} active connections`);
    passedChecks++;
  } catch (error) {
    totalChecks++;
    check('Streaming manager', 'fail', error instanceof Error ? error.message : 'Unknown');
    failedChecks++;
  }

  // Summary
  section('Summary');

  console.log(`Total checks: ${totalChecks}`);
  console.log(`${c.green}✓ Passed: ${passedChecks}${c.reset}`);

  if (warnings > 0) {
    console.log(`${c.yellow}⚠ Warnings: ${warnings}${c.reset}`);
  }

  if (failedChecks > 0) {
    console.log(`${c.red}✗ Failed: ${failedChecks}${c.reset}`);
  }

  const healthScore = Math.round((passedChecks / totalChecks) * 100);
  console.log(`\nHealth Score: ${healthScore}%`);

  if (healthScore === 100) {
    console.log(`${c.green}System is healthy and ready!${c.reset}`);
  } else if (healthScore >= 80) {
    console.log(`${c.yellow}System is mostly healthy with minor issues${c.reset}`);
  } else if (healthScore >= 60) {
    console.log(`${c.yellow}System has significant issues that should be addressed${c.reset}`);
  } else {
    console.log(`${c.red}System has critical issues and may not function correctly${c.reset}`);
  }

  // Recommendations
  if (failedChecks > 0 || warnings > 0) {
    section('Recommendations');

    if (failedChecks > 0) {
      console.log(`${c.red}Critical Issues:${c.reset}`);
      console.log('  1. Fix failed checks above before proceeding');
      console.log('  2. Verify environment variables are set correctly');
      console.log('  3. Check Supabase connection and migrations');
      console.log('  4. Ensure Google AI API key is valid\n');
    }

    if (warnings > 0) {
      console.log(`${c.yellow}Warnings:${c.reset}`);
      console.log('  1. Review warnings for potential issues');
      console.log('  2. Consider clearing stuck jobs if any');
      console.log('  3. Monitor pending job queue depth');
      console.log('  4. Ensure background worker is running\n');
    }

    console.log(`${c.blue}Next Steps:${c.reset}`);
    console.log('  • Fix critical issues first');
    console.log('  • Run: yarn worker:dev (to process jobs)');
    console.log('  • Run: yarn tsx scripts/test-processing-flow.ts (full test)');
    console.log('  • Check: PROCESSING_PIPELINE_DEBUG_GUIDE.md (for detailed help)');
  }

  console.log('');

  // Exit with appropriate code
  process.exit(failedChecks > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`${c.red}Fatal error:${c.reset}`, error);
  process.exit(1);
});

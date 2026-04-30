#!/usr/bin/env tsx
/**
 * Check Job Schema
 */

import { resolve } from 'path';

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  // Get the job we just created
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Job structure:');
  console.log(JSON.stringify(job, null, 2));
}

checkSchema().catch(console.error);

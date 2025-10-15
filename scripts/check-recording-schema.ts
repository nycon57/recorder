#!/usr/bin/env tsx
/**
 * Check Recording Schema
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  // Get one recording to see its structure
  const { data: recording, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', '80e70735-9b25-4c8a-8345-c7d41545ccc7')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recording structure:');
  console.log(JSON.stringify(recording, null, 2));
}

checkSchema().catch(console.error);
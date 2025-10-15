import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const recordingId = '80e70735-9b25-4c8a-8345-c7d41545ccc7';

async function main() {
  // Check transcript
  const { data: transcript } = await supabase
    .from('transcripts')
    .select('text')
    .eq('recording_id', recordingId)
    .single();

  console.log('📝 TRANSCRIPT:');
  console.log('Length:', transcript?.text?.length || 0);
  console.log('Content:', transcript?.text?.substring(0, 500) || '(empty)');
  console.log('');

  // Check document
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('recording_id', recordingId)
    .single();

  console.log('📄 DOCUMENT:');
  console.log('All columns:', Object.keys(doc || {}).join(', '));
  console.log('Title:', doc?.title || '(no title)');
  console.log('Content length:', (doc as any)?.content?.length || 0);
  console.log('Markdown length:', (doc as any)?.markdown?.length || 0);
  console.log('Content preview:', ((doc as any)?.content || (doc as any)?.markdown || '').substring(0, 500) || '(empty)');
}

main().catch(console.error);

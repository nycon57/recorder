import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client with service role key
 * Use with caution - bypasses RLS policies
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

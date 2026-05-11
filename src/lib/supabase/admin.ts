import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import {
  asLightweightSupabaseClient,
  type LightweightSupabaseClient,
} from '@/lib/supabase/types';

// Lazy initialization to avoid loading env vars at import time
let _supabaseAdmin: LightweightSupabaseClient | null = null;

/**
 * Supabase Admin Client with service role key
 * Use with caution - bypasses RLS policies
 *
 * Lazily initialized on first access to support environment variable loading
 */
export const supabaseAdmin = new Proxy({} as LightweightSupabaseClient, {
  get(target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = asLightweightSupabaseClient(
        createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )
      );
    }
    return (_supabaseAdmin as any)[prop];
  },
});

/**
 * Create a new admin client instance (for handlers that need fresh instances)
 */
export function createClient() {
  return asLightweightSupabaseClient(
    createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  );
}

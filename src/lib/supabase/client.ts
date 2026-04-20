import { createBrowserClient } from '@supabase/ssr';
import {
  asLightweightSupabaseClient,
  type LightweightSupabaseClient,
} from '@/lib/supabase/types';

export function createClient(): LightweightSupabaseClient {
  return asLightweightSupabaseClient(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
}

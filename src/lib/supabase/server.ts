import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  asLightweightSupabaseClient,
  type LightweightSupabaseClient,
} from '@/lib/supabase/types';

export async function createClient(): Promise<LightweightSupabaseClient> {
  const cookieStore = await cookies();

  return asLightweightSupabaseClient(
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Called from Server Component — safe to ignore
            }
          },
        },
      }
    )
  );
}

// Alias for compatibility with existing imports
export const createSupabaseClient = createClient;

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.SISTRUM_SUPABASE_URL?.trim();
  const key = process.env.SISTRUM_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { usableEnv } from './env';

const supabaseUrl = usableEnv(import.meta.env.VITE_SUPABASE_URL);
const supabasePublishableKey =
  usableEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  usableEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  usableEnv(import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabasePublishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return supabase;
}

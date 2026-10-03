import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey && !supabasePublishableKey.startsWith('sb_secret_')
);

if (supabasePublishableKey?.startsWith('sb_secret_')) {
  throw new Error('A secret key must never be used in the browser.');
}

const url = isSupabaseConfigured ? supabaseUrl : 'https://unconfigured.supabase.local';
const key = isSupabaseConfigured ? supabasePublishableKey : 'public-unconfigured';

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl:
      isSupabaseConfigured &&
      typeof window !== 'undefined' &&
      !new URLSearchParams(window.location.search).has('state'),
  },
});

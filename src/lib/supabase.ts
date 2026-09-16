import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL');
}

if (supabasePublishableKey?.startsWith('sb_secret_')) throw new Error('A secret key must never be used in the browser.');

if (!supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Spotify also uses a code query parameter; do not consume its callback.
      detectSessionInUrl: typeof window !== 'undefined' && !new URLSearchParams(window.location.search).has('state'),
    },
  }
);

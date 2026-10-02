import { createClient } from '@supabase/supabase-js';

// Server-only: never expose service-role to browser
const SISTRUM_SUPABASE_URL = process.env.SISTRUM_SUPABASE_URL;
const SISTRUM_SUPABASE_PUBLISHABLE_KEY = process.env.SISTRUM_SUPABASE_PUBLISHABLE_KEY;
const NRN_CATALOG_SUPABASE_URL = process.env.NRN_CATALOG_SUPABASE_URL;
const NRN_CATALOG_SUPABASE_SERVICE_ROLE_KEY = process.env.NRN_CATALOG_SUPABASE_SERVICE_ROLE_KEY;
const NRN_CATALOG_USER_ID = process.env.NRN_CATALOG_USER_ID;

const ALLOWED_FIELDS =
  'id,title,artist,album,release_date,isrc,upc,bpm,key,duration_seconds,genre,cover_url,spotify_id,apple_music_id,soundcloud_id';

function escapeIlike(value: string): string {
  // Escape % , _ and comma for PostgREST or filter
  return value.replace(/[%_,]/g, '\\$&').replace(/,/g, '');
}

// Vercel Node function signature
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate server env — do not leak which is missing
  if (
    !SISTRUM_SUPABASE_URL ||
    !SISTRUM_SUPABASE_PUBLISHABLE_KEY ||
    !NRN_CATALOG_SUPABASE_URL ||
    !NRN_CATALOG_SUPABASE_SERVICE_ROLE_KEY ||
    !NRN_CATALOG_USER_ID
  ) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // Validate Sistrum access token
  const authHeader: string | undefined = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  try {
    const sistrumClient = createClient(SISTRUM_SUPABASE_URL, SISTRUM_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await sistrumClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const rawQ = typeof req.query?.q === 'string' ? req.query.q : '';
    const q = rawQ.trim();

    if (!q || q.length < 1) {
      return res.status(200).json([]);
    }
    if (q.length > 100) {
      return res.status(400).json({ error: 'Query too long' });
    }

    const safeQ = escapeIlike(q);

    const catalogClient = createClient(NRN_CATALOG_SUPABASE_URL, NRN_CATALOG_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await catalogClient
      .from('tracks')
      .select(ALLOWED_FIELDS)
      .eq('user_id', NRN_CATALOG_USER_ID)
      .or(`title.ilike.%${safeQ}%,artist.ilike.%${safeQ}%`)
      .limit(20);

    if (error) {
      console.error('Catalog search error', error.message);
      return res.status(500).json({ error: 'Catalog query failed' });
    }

    // Ensure only allowed fields are returned (defense in depth)
    const sanitized = (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album ?? null,
      release_date: row.release_date ?? null,
      isrc: row.isrc ?? null,
      upc: row.upc ?? null,
      bpm: row.bpm ?? null,
      key: row.key ?? null,
      duration_seconds: row.duration_seconds ?? null,
      genre: row.genre ?? null,
      cover_url: row.cover_url ?? null,
      spotify_id: row.spotify_id ?? null,
      apple_music_id: row.apple_music_id ?? null,
      soundcloud_id: row.soundcloud_id ?? null,
    }));

    return res.status(200).json(sanitized);
  } catch (err: any) {
    console.error('catalog/search unexpected', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

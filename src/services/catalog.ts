import { supabase } from '../lib/supabase';

export interface CatalogTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  release_date: string | null;
  isrc: string | null;
  upc: string | null;
  bpm: number | null;
  key: string | null;
  duration_seconds: number | null;
  genre: string | null;
  cover_url: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  soundcloud_id: string | null;
}

export async function searchCatalog(query: string): Promise<CatalogTrack[]> {
  const q = query.trim();
  if (!q) return [];
  if (q.length > 100) throw new Error('Query too long');

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    throw new Error('Not authenticated — please sign in again.');
  }

  const url = `/api/catalog/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    throw new Error('Unauthorized — please sign in again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Catalog search failed (${res.status})`);
  }

  const data = (await res.json()) as CatalogTrack[];
  // Defense: ensure array
  return Array.isArray(data) ? data : [];
}

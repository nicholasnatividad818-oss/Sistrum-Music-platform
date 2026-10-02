import type { Track } from '../types';
import { requireSupabase } from '../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTrackUuid(id: string): boolean {
  return UUID_RE.test(id);
}

interface TrackRow {
  id: string;
  owner_id: string;
  title: string;
  artist_name: string;
  artist_avatar_url: string | null;
  cover_art_url: string | null;
  audio_url: string | null;
  duration_seconds: number;
  bpm: number;
  genre: string;
  tags: string[] | null;
  waveform_data: number[] | null;
  play_count: number;
  like_count: number;
  repost_count: number;
  comment_count: number;
  description: string | null;
  synth_preset: Track['synthPreset'] | null;
  release_date: string;
  catalog_track_id?: string | null;
  catalog_source?: string | null;
  isrc?: string | null;
  catalog_synced_at?: string | null;
}

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80';

export function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist_name,
    artistId: row.owner_id,
    artistAvatar: row.artist_avatar_url || '',
    coverArt: row.cover_art_url || FALLBACK_COVER,
    duration: row.duration_seconds || 0,
    bpm: row.bpm || 0,
    genre: row.genre || 'Electronic',
    tags: row.tags || [],
    waveformData: Array.isArray(row.waveform_data) && row.waveform_data.length > 0 ? row.waveform_data : [0.4, 0.6, 0.5],
    playCount: Number(row.play_count) || 0,
    likeCount: Number(row.like_count) || 0,
    repostCount: Number(row.repost_count) || 0,
    commentCount: Number(row.comment_count) || 0,
    releaseDate: row.release_date,
    description: row.description || undefined,
    audioUrl: row.audio_url || undefined,
    synthPreset: row.synth_preset || undefined,
    catalogTrackId: row.catalog_track_id || undefined,
    catalogSource: row.catalog_source === 'nrn-catalog' ? 'nrn-catalog' : undefined,
    isrc: row.isrc || undefined,
    catalogSyncedAt: row.catalog_synced_at || undefined,
  };
}

function catalogError(err: unknown): Error {
  const message = err instanceof Error ? err.message : 'Could not load tracks';
  if (/failed to fetch|network|load failed|enotfound|timeout/i.test(message)) {
    return new Error('Could not reach Supabase. Use the project URL from the Supabase dashboard, then run the SQL files in supabase/.');
  }
  return err instanceof Error ? err : new Error(message);
}

export async function listTracks(): Promise<Track[]> {
  const supabase = requireSupabase();
  const query = supabase
    .from('tracks')
    .select('*')
    .order('release_date', { ascending: false })
    .limit(100);
  const { data, error } = await Promise.race([
    query,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Could not reach Supabase (timeout).')), 8000);
    }),
  ]);
  if (error) throw catalogError(new Error(error.message));
  return ((data || []) as TrackRow[]).map(rowToTrack);
}

async function uploadToBucket(bucket: 'audio' | 'cover-art', userId: string, file: File): Promise<string> {
  const supabase = requireSupabase();
  const ext = file.name.includes('.') ? file.name.split('.').pop() : bucket === 'audio' ? 'mp3' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || (bucket === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export interface PublishInput {
  userId: string;
  title: string;
  artistName: string;
  genre: string;
  tags: string[];
  description: string;
  bpm: number;
  duration: number;
  waveform: number[];
  audioFile?: File | null;
  coverFile?: File | null;
  coverUrl?: string;
  synthPreset?: Track['synthPreset'];
  catalogTrackId?: string;
  isrc?: string;
}

export async function publishTrack(input: PublishInput): Promise<Track> {
  const supabase = requireSupabase();
  const audioBytes = input.audioFile?.size || 0;
  const { error: limitError } = await supabase.rpc('assert_upload_allowed', { p_bytes: audioBytes });
  if (limitError) {
    throw new Error(limitError.message || 'Upload is not allowed on your plan');
  }

  let audioUrl: string | undefined;
  let coverUrl = input.coverUrl;
  try {
    if (input.audioFile) {
      audioUrl = await uploadToBucket('audio', input.userId, input.audioFile);
    }
    if (input.coverFile) {
      coverUrl = await uploadToBucket('cover-art', input.userId, input.coverFile);
    }

    const { data, error } = await supabase.rpc('create_track', {
      payload: {
        title: input.title,
        artist_name: input.artistName,
        cover_art_url: coverUrl || null,
        audio_url: audioUrl || null,
        duration_seconds: Math.round(input.duration),
        bpm: input.bpm,
        genre: input.genre,
        tags: input.tags,
        waveform_data: input.waveform,
        description: input.description,
        synth_preset: input.synthPreset || null,
        audio_bytes: audioBytes,
        is_public: true,
        catalog_track_id: input.catalogTrackId || null,
        isrc: input.isrc || null,
        catalog_source: input.catalogTrackId ? 'nrn-catalog' : null,
      },
    });
    if (error) throw new Error(error.message);
    return rowToTrack(data as TrackRow);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Publish failed');
  }
}

export async function recordPlay(trackId: string): Promise<void> {
  if (!isTrackUuid(trackId)) return;
  const { error } = await requireSupabase().rpc('increment_play_count', { p_track_id: trackId });
  if (error) console.error('play count', error.message);
}

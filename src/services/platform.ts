import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Artist, Comment, Playlist, Track, UserProfile } from '../types';
import type { Tables } from '../lib/database.types';

type ProfileRow = Tables<'profiles'>;
type TrackRow = Tables<'tracks'>;
type CommentRow = Tables<'comments'>;
type PlaylistRow = Tables<'playlists'>;

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1520975958225-57c3a5b11c0b?w=300&auto=format&fit=crop&q=80';
const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=900&auto=format&fit=crop&q=85';
const FALLBACK_BANNER =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1400&auto=format&fit=crop&q=80';

export interface PlatformData {
  tracks: Track[];
  artists: Artist[];
  playlists: Playlist[];
  comments: Record<string, Comment[]>;
  followedArtistIds: string[];
  profile: UserProfile | null;
}

function relativeDate(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username || 'Sistrum Artist',
    avatarUrl: row.avatar_url || FALLBACK_AVATAR,
    bannerUrl: row.banner_url || FALLBACK_BANNER,
    bio: row.bio || 'Independent artist on Sistrum.',
    location: row.location || '',
    isVerified: row.is_verified,
    termsAcceptedAt: row.terms_accepted_at,
  };
}

function mapTrack(
  row: TrackRow,
  profile: UserProfile | undefined,
  liked: Set<string>,
  reposted: Set<string>
): Track {
  const waveform = Array.isArray(row.waveform_data)
    ? row.waveform_data.filter((value): value is number => typeof value === 'number')
    : [];
  return {
    id: row.id,
    title: row.title,
    artist: row.artist_name || profile?.displayName || 'Sistrum Artist',
    artistId: row.owner_id,
    artistAvatar: row.artist_avatar_url || profile?.avatarUrl || FALLBACK_AVATAR,
    coverArt: row.cover_art_url || FALLBACK_COVER,
    duration: row.duration_seconds,
    bpm: row.bpm,
    genre: row.genre || 'Independent',
    tags: row.tags || [],
    waveformData: waveform.length ? waveform : [0.22, 0.4, 0.62, 0.8, 0.55, 0.35, 0.7],
    playCount: Number(row.play_count),
    likeCount: Number(row.like_count),
    repostCount: Number(row.repost_count),
    commentCount: Number(row.comment_count),
    releaseDate: relativeDate(row.release_date),
    description: row.description || undefined,
    isLiked: liked.has(row.id),
    isReposted: reposted.has(row.id),
    audioUrl: row.audio_url || undefined,
    catalogTrackId: row.catalog_track_id || undefined,
    catalogSource: row.catalog_source === 'nrn-catalog' ? 'nrn-catalog' : undefined,
    isrc: row.isrc || undefined,
    catalogSyncedAt: row.catalog_synced_at || undefined,
    synthPreset: (row.synth_preset as Track['synthPreset']) || 'synthwave',
  };
}

export async function loadPlatformData(user: User | null): Promise<PlatformData> {
  const baseQueries = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('tracks').select('*').order('release_date', { ascending: false }),
    supabase.from('comments').select('*').order('created_at', { ascending: true }),
    supabase.from('playlists').select('*').order('created_at', { ascending: false }),
    supabase.from('playlist_tracks').select('*').order('position', { ascending: true }),
  ]);

  const firstError = baseQueries.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const [profileResult, trackResult, commentResult, playlistResult, playlistTrackResult] = baseQueries;
  const profiles = (profileResult.data || []).map(mapProfile);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const userQueries = user
    ? await Promise.all([
        supabase.from('track_likes').select('track_id').eq('user_id', user.id),
        supabase.from('track_reposts').select('track_id').eq('user_id', user.id),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
      ])
    : [];
  const userError = userQueries.find((result) => result.error)?.error;
  if (userError) throw userError;

  const liked = new Set<string>(
    ((userQueries[0]?.data || []) as Array<{ track_id: string }>).map((row) => row.track_id)
  );
  const reposted = new Set<string>(
    ((userQueries[1]?.data || []) as Array<{ track_id: string }>).map((row) => row.track_id)
  );
  const followedArtistIds = (
    (userQueries[2]?.data || []) as Array<{ following_id: string }>
  ).map((row) => row.following_id);
  const tracks = ((trackResult.data || []) as TrackRow[]).map((row) =>
    mapTrack(row, profileMap.get(row.owner_id), liked, reposted)
  );

  const artists: Artist[] = profiles.map((profile) => ({
    id: profile.id,
    name: profile.displayName,
    handle: profile.username || profile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    avatar: profile.avatarUrl,
    banner: profile.bannerUrl,
    bio: profile.bio,
    location: profile.location,
    followersCount: 0,
    followingCount: 0,
    tracksCount: tracks.filter((track) => track.artistId === profile.id).length,
    isVerified: profile.isVerified,
    spotlightTrackId: tracks.find((track) => track.artistId === profile.id)?.id,
  }));

  const comments: Record<string, Comment[]> = {};
  for (const row of (commentResult.data || []) as CommentRow[]) {
    const author = profileMap.get(row.user_id);
    const mapped: Comment = {
      id: row.id,
      trackId: row.track_id,
      userId: row.user_id,
      userName: author?.displayName || 'Sistrum listener',
      userAvatar: author?.avatarUrl || FALLBACK_AVATAR,
      text: row.body,
      timestamp: row.timestamp_seconds,
      createdAt: relativeDate(row.created_at),
      likes: 0,
    };
    comments[row.track_id] = [...(comments[row.track_id] || []), mapped];
  }

  const playlistTracks = playlistTrackResult.data || [];
  const playlists: Playlist[] = ((playlistResult.data || []) as PlaylistRow[]).map((row) => {
    const owner = profileMap.get(row.owner_id);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      coverArt: row.cover_art_url || FALLBACK_COVER,
      creator: owner?.displayName || 'Sistrum artist',
      creatorAvatar: owner?.avatarUrl || FALLBACK_AVATAR,
      trackIds: playlistTracks
        .filter((item) => item.playlist_id === row.id)
        .map((item) => item.track_id),
      isPublic: row.is_public,
      likesCount: 0,
      createdAt: relativeDate(row.created_at),
    };
  });

  return {
    tracks,
    artists,
    playlists,
    comments,
    followedArtistIds,
    profile: user ? profileMap.get(user.id) || null : null,
  };
}

export async function setTrackLike(userId: string, trackId: string, active: boolean) {
  const result = active
    ? await supabase.from('track_likes').insert({ user_id: userId, track_id: trackId })
    : await supabase.from('track_likes').delete().eq('user_id', userId).eq('track_id', trackId);
  if (result.error) throw result.error;
}

export async function setTrackRepost(userId: string, trackId: string, active: boolean) {
  const result = active
    ? await supabase.from('track_reposts').insert({ user_id: userId, track_id: trackId })
    : await supabase.from('track_reposts').delete().eq('user_id', userId).eq('track_id', trackId);
  if (result.error) throw result.error;
}

export async function setArtistFollow(userId: string, artistId: string, active: boolean) {
  const result = active
    ? await supabase.from('follows').insert({ follower_id: userId, following_id: artistId })
    : await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', artistId);
  if (result.error) throw result.error;
}

export async function createComment(
  userId: string,
  trackId: string,
  text: string,
  timestamp: number
) {
  const { error } = await supabase.from('comments').insert({
    user_id: userId,
    track_id: trackId,
    body: text.trim(),
    timestamp_seconds: Math.max(0, Math.round(timestamp)),
  });
  if (error) throw error;
}

export async function createPlaylist(
  userId: string,
  title: string,
  description: string,
  firstTrackId?: string
) {
  const { data, error } = await supabase
    .from('playlists')
    .insert({ owner_id: userId, title: title.trim(), description: description.trim(), is_public: true })
    .select('id')
    .single();
  if (error) throw error;
  if (firstTrackId) {
    const { error: trackError } = await supabase
      .from('playlist_tracks')
      .insert({ playlist_id: data.id, track_id: firstTrackId, position: 0 });
    if (trackError) throw trackError;
  }
}

export async function setPlaylistTrack(
  playlistId: string,
  trackId: string,
  active: boolean,
  position: number
) {
  const result = active
    ? await supabase.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: trackId, position })
    : await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId).eq('track_id', trackId);
  if (result.error) throw result.error;
}

function safeFileName(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `${crypto.randomUUID()}.${extension}`;
}

export interface PublishTrackInput {
  user: User;
  profile: UserProfile | null;
  title: string;
  artist: string;
  genre: string;
  tags: string[];
  description: string;
  duration: number;
  waveformData: number[];
  audioFile?: File | null;
  coverFile?: File | null;
  coverPresetUrl?: string;
  bpm?: number;
  synthPreset?: Track['synthPreset'];
}

export async function publishTrack(input: PublishTrackInput): Promise<void> {
  const uploaded: Array<{ bucket: 'audio' | 'cover-art'; path: string }> = [];
  try {
    let audioUrl: string | null = null;
    let coverUrl = input.coverPresetUrl || FALLBACK_COVER;

    if (input.audioFile) {
      const path = `${input.user.id}/${safeFileName(input.audioFile)}`;
      const { error } = await supabase.storage.from('audio').upload(path, input.audioFile, {
        cacheControl: '3600',
        contentType: input.audioFile.type || 'audio/mpeg',
        upsert: false,
      });
      if (error) throw error;
      uploaded.push({ bucket: 'audio', path });
      audioUrl = supabase.storage.from('audio').getPublicUrl(path).data.publicUrl;
    }

    if (input.coverFile) {
      const path = `${input.user.id}/${safeFileName(input.coverFile)}`;
      const { error } = await supabase.storage.from('cover-art').upload(path, input.coverFile, {
        cacheControl: '3600',
        contentType: input.coverFile.type || 'image/jpeg',
        upsert: false,
      });
      if (error) throw error;
      uploaded.push({ bucket: 'cover-art', path });
      coverUrl = supabase.storage.from('cover-art').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from('tracks').insert({
      owner_id: input.user.id,
      title: input.title.trim(),
      artist_name: input.artist.trim() || input.profile?.displayName || 'Sistrum Artist',
      artist_avatar_url: input.profile?.avatarUrl || null,
      cover_art_url: coverUrl,
      audio_url: audioUrl,
      duration_seconds: Math.max(0, Math.round(input.duration)),
      bpm: Math.max(0, Math.round(input.bpm || 0)),
      genre: input.genre,
      tags: input.tags,
      waveform_data: input.waveformData,
      description: input.description.trim(),
      synth_preset: input.synthPreset || 'synthwave',
      is_public: true,
      release_date: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (error) {
    await Promise.all(uploaded.map((item) => supabase.storage.from(item.bucket).remove([item.path])));
    throw error;
  }
}

export async function reportTrack(
  userId: string,
  trackId: string,
  reason: 'copyright' | 'harassment' | 'spam' | 'other',
  details: string
) {
  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: userId, track_id: trackId, reason, details: details.trim() });
  if (error) throw error;
}

export async function deleteCurrentAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
}

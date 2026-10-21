-- Original lyrics for Gemini studio + track pages.
alter table public.tracks
  add column if not exists lyrics text;

alter table public.tracks
  drop constraint if exists tracks_lyrics_length;

alter table public.tracks
  add constraint tracks_lyrics_length check (lyrics is null or char_length(lyrics) <= 8000);

grant insert (owner_id, title, artist_name, artist_avatar_url, cover_art_url, audio_url,
              duration_seconds, bpm, genre, tags, waveform_data, description, lyrics, synth_preset,
              is_public, release_date)
  on public.tracks to authenticated;

grant update (title, artist_name, artist_avatar_url, cover_art_url, audio_url,
              duration_seconds, bpm, genre, tags, waveform_data, description, lyrics, synth_preset,
              is_public, release_date, updated_at)
  on public.tracks to authenticated;

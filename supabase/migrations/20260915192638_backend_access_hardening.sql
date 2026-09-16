-- Owners must be able to select their own object metadata for delete/update.
create policy "Owners read own upload metadata" on storage.objects
for select to authenticated
using (bucket_id in ('audio','cover-art') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Do not allow social writes to hidden tracks, even when their UUID is known.
alter policy "Users create own likes" on public.track_likes
with check ((select auth.uid()) = user_id and exists (
 select 1 from public.tracks t where t.id = track_id and t.is_public));
alter policy "Users create own reposts" on public.track_reposts
with check ((select auth.uid()) = user_id and exists (
 select 1 from public.tracks t where t.id = track_id and t.is_public));
alter policy "Playlist owners add tracks" on public.playlist_tracks
with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid()))
 and exists (select 1 from public.tracks t where t.id = track_id and t.is_public));
alter policy "Visible playlist tracks are readable" on public.playlist_tracks
using (exists (select 1 from public.playlists p where p.id = playlist_id and (p.is_public or p.owner_id = (select auth.uid())))
 and exists (select 1 from public.tracks t where t.id = track_id));

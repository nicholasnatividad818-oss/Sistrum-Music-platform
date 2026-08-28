-- ============================================================
-- SISTRUM ↔ NRN CATALOG BRIDGE
-- Adds external catalog identity without merging databases.
-- ============================================================

alter table public.tracks
  add column if not exists catalog_track_id uuid,
  add column if not exists catalog_source text
    default 'nrn-catalog',
  add column if not exists isrc text,
  add column if not exists catalog_synced_at timestamptz;

create index if not exists tracks_catalog_track_id_idx
  on public.tracks(catalog_track_id);

create index if not exists tracks_isrc_idx
  on public.tracks(isrc);

create unique index if not exists tracks_owner_catalog_track_uidx
  on public.tracks(owner_id, catalog_source, catalog_track_id)
  where catalog_track_id is not null;

comment on column public.tracks.catalog_track_id is
  'Track UUID from the external NRN Catalog system.';

comment on column public.tracks.catalog_source is
  'Source catalog identifier. Defaults to nrn-catalog.';

comment on column public.tracks.isrc is
  'ISRC copied from the authoritative catalog record for matching/display.';

comment on column public.tracks.catalog_synced_at is
  'Last successful metadata synchronization from NRN Catalog.';

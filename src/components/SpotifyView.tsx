import { useEffect, useRef, useState } from 'react';
import { connectSpotify, disconnectSpotify, finishSpotifyConnection, getNRNReleases, getSpotifyProfile, isSpotifyConnected, searchSpotifyTracks, type SpotifyAlbum, type SpotifyProfile, type SpotifyTrack } from '../services/spotify';

export function SpotifyView() {
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [connected, setConnected] = useState(isSpotifyConnected);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [searched, setSearched] = useState(false);
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loadedAlbums, setLoadedAlbums] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const request = useRef(0);
  const button = 'rounded-xl px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold';
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await finishSpotifyConnection();
        if (!active) return;
        if (isSpotifyConnected()) {
          const user = await getSpotifyProfile();
          if (active) { setProfile(user); setConnected(true); }
        }
      } catch (err) { if (active) { setError(err instanceof Error ? err.message : 'Spotify connection failed.'); setConnected(isSpotifyConnected()); } }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; request.current++; };
  }, []);
  async function run(action: () => Promise<void>) {
    const id = ++request.current;
    setError(''); setBusy(true);
    try { await action(); }
    catch (err) { if (id === request.current) { setError(err instanceof Error ? err.message : 'Spotify request failed.'); setConnected(isSpotifyConnected()); } }
    finally { if (id === request.current) setBusy(false); }
  }
  function disconnect() {
    request.current++; disconnectSpotify(); setConnected(false); setProfile(null); setTracks([]); setAlbums([]); setNext(null); setSearched(false); setLoadedAlbums(false); setError(''); setBusy(false);
  }
  return <section className="mx-auto max-w-5xl pb-32 space-y-6">
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 md:p-8 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-green-400">Sistrum × Spotify</p>
      <h1 className="text-3xl font-black">Your Spotify connection</h1>
      <p className="text-neutral-400">Explore the Spotify catalog and NRN releases, with direct links to listen on Spotify.</p>
      <div className="flex flex-wrap items-center gap-3">
        {connected ? <><span className="text-green-400">{profile ? `Connected as ${profile.display_name || profile.id}` : 'Spotify session saved'}</span><button className={button} disabled={busy} onClick={disconnect}>Disconnect Spotify</button></> : <button className="rounded-full bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 disabled:opacity-50" disabled={busy} onClick={() => run(connectSpotify)}>Connect Spotify</button>}
        {busy && <span role="status" className="text-sm text-neutral-400">Connecting or loading Spotify…</span>}
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-red-200 text-sm">{error}</p>}
      <p className="text-xs text-neutral-500">Connection lasts for this browser tab’s session. Spotify for Artists stream counts, royalties, and profile editing are managed separately.</p>
    </div>
    {connected && <>
      <form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); if (!query.trim() || busy) return; const id = request.current + 1; void run(async () => { const result = await searchSpotifyTracks(query); if (id === request.current) { setTracks(result.tracks?.items || []); setSearched(true); } }); }}>
        <label htmlFor="spotify-search" className="sr-only">Search Spotify tracks</label>
        <input id="spotify-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Spotify tracks or artists" className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3" />
        <button className={button} disabled={busy || !query.trim()}>Search Spotify</button>
      </form>
      {searched && <div className="space-y-3"><h2 className="text-xl font-bold">Spotify search results</h2>{tracks.length === 0 && <p className="text-neutral-400">No tracks found. Try another title or artist.</p>}{tracks.map(track => <a key={track.id} href={`https://open.spotify.com/track/${track.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-green-500">
        {track.album?.images?.[0]?.url && <img src={track.album.images[0].url} alt="" className="w-16 h-16 object-contain rounded" />}
        <div className="min-w-0 flex-1"><p className="font-bold">{track.name}</p><p className="text-sm text-neutral-400">{track.artists.map(artist => artist.name).join(', ')}</p>{track.external_ids?.isrc && <p className="text-xs text-neutral-500">ISRC: {track.external_ids.isrc}</p>}</div><span className="text-xs text-green-400">Open in Spotify ↗</span>
      </a>)}</div>}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">NRN releases on Spotify</h2><button className={button} disabled={busy} onClick={() => { const id = request.current + 1; void run(async () => { const page = await getNRNReleases(); if (id === request.current) { setAlbums(page.items); setNext(page.next); setLoadedAlbums(true); } }); }}>{loadedAlbums ? 'Refresh releases' : 'Load NRN releases'}</button></div>
        {loadedAlbums && !albums.length && <p className="text-neutral-400">No releases are available for this account’s market.</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{albums.map(album => <a key={album.id} href={`https://open.spotify.com/album/${album.id}`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3 hover:border-green-500 space-y-2">
          {album.images?.[0]?.url && <img src={album.images[0].url} alt="" className="w-full aspect-square object-contain rounded-lg" />}<p className="font-bold">{album.name}</p><p className="text-xs text-neutral-400">{album.release_date}</p><p className="text-xs text-green-400">Open in Spotify ↗</p>
        </a>)}</div>
        {next && <button className={button} disabled={busy} onClick={() => { const id = request.current + 1; void run(async () => { const page = await getNRNReleases(next); if (id === request.current) { setAlbums(previous => Array.from(new Map([...previous, ...page.items].map(album => [album.id, album])).values())); setNext(page.next); } }); }}>Load more releases</button>}
      </div>
    </>}
  </section>;
}

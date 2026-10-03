import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Film,
  Heart,
  Music2,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  Volume2
} from 'lucide-react';
import { feedFmRadio, FeedFmRadioSnapshot } from '../services/feedFmRadio';
import { feedClips, FeedClip, FeedClipCollection } from '../services/feedClips';

const initialRadio: FeedFmRadioSnapshot = {
  state: 'unconfigured',
  stations: [],
  canSkip: false,
  volume: 85
};

export function NRNMusicView() {
  const [mode, setMode] = useState<'radio' | 'clips' | 'creator'>('radio');
  const [radio, setRadio] = useState(initialRadio);
  const [collections, setCollections] = useState<FeedClipCollection[]>([]);
  const [clips, setClips] = useState<FeedClip[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [clipsMessage, setClipsMessage] = useState('');
  const [loadingClips, setLoadingClips] = useState(false);

  useEffect(() => {
    const unsubscribe = feedFmRadio.subscribe(setRadio);
    feedFmRadio.initialize();
    feedClips.appStart().catch(() => undefined);

    if (feedClips.isConfigured()) {
      setLoadingClips(true);
      feedClips
        .getCollections()
        .then((items) => {
          setCollections(items);
          if (items[0]) setSelectedCollection(items[0].id);
        })
        .catch((error) => setClipsMessage(error instanceof Error ? error.message : 'Could not load Feed Clips.'))
        .finally(() => setLoadingClips(false));
    }

    const close = () => feedClips.appClose().catch(() => undefined);
    window.addEventListener('pagehide', close);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', close);
    };
  }, []);

  useEffect(() => {
    if (!selectedCollection || !feedClips.isConfigured()) return;
    setLoadingClips(true);
    feedClips
      .getClips(selectedCollection)
      .then(setClips)
      .catch((error) => setClipsMessage(error instanceof Error ? error.message : 'Could not load clips.'))
      .finally(() => setLoadingClips(false));
  }, [selectedCollection]);

  const radioConfigured = radio.state !== 'unconfigured';
  const clipsConfigured = feedClips.isConfigured();
  const statusLabel = useMemo(() => radio.state.replaceAll('-', ' '), [radio.state]);

  const previewClip = async (clip: FeedClip) => {
    if (!clip.url) return;
    try {
      await feedClips.report(clip.id, 'preview');
      const audio = new Audio(clip.url);
      audio.volume = 0.85;
      await audio.play();
    } catch (error) {
      setClipsMessage(error instanceof Error ? error.message : 'Clip preview failed.');
    }
  };

  return (
    <section className="pb-32 space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-neutral-800 bg-gradient-to-br from-neutral-950 via-[#151019] to-neutral-950 p-7 md:p-10">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#ff5500]/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#ff6a24]">
            <Sparkles className="h-4 w-4" /> NRN Music Infrastructure
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
            One music layer. <span className="text-[#ff5500]">Every NRN experience.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-neutral-400">
            Stream licensed radio, soundtrack short-form video with licensed clips, and keep NRN-owned music in the same creative ecosystem.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ['Radio', 'radio', Radio],
              ['Clips', 'clips', Music2],
              ['Creator', 'creator', Film]
            ].map(([label, value, Icon]) => (
              <button
                key={String(value)}
                onClick={() => setMode(value as typeof mode)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  mode === value ? 'bg-[#ff5500] text-white' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" /> {label as string}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Capability icon={ShieldCheck} title="Rights-aware" copy="Territory, playback and reporting restrictions stay attached to the licensed provider instead of being bypassed by the UI." />
        <Capability icon={SlidersHorizontal} title="Dual-stream ready" copy="Music can remain independent from narration, drama dialogue, video and other NRN media." />
        <Capability icon={BadgeCheck} title="Provider agnostic" copy="Feed.fm is one provider layer. NRN-owned catalog and future licensed providers can live beside it." />
      </div>

      {mode === 'radio' && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-[24px] border border-neutral-800 bg-neutral-950/70 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Feed Radio</div>
                <h2 className="mt-1 text-2xl font-black text-white">NRN Radio</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${radioConfigured ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                {statusLabel}
              </span>
            </div>

            <div className="mt-8 rounded-2xl border border-neutral-800 bg-[#0b0b0f] p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Now Playing</div>
              <div className="mt-2 text-xl font-black text-white">{radio.nowPlaying?.title ?? 'Licensed radio ready'}</div>
              <div className="mt-1 text-sm text-neutral-400">
                {radio.nowPlaying ? `${radio.nowPlaying.artist}${radio.nowPlaying.album ? ` · ${radio.nowPlaying.album}` : ''}` : radio.message ?? 'Choose a station and press play.'}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button onClick={() => (radio.state === 'playing' ? feedFmRadio.pause() : feedFmRadio.play())} disabled={!radioConfigured} className="grid h-12 w-12 place-items-center rounded-full bg-[#ff5500] text-white disabled:cursor-not-allowed disabled:opacity-40">
                  {radio.state === 'playing' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                </button>
                <button onClick={() => feedFmRadio.skip()} disabled={!radio.canSkip} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-900 text-neutral-300 disabled:opacity-30"><SkipForward className="h-4 w-4" /></button>
                <button onClick={() => feedFmRadio.like()} disabled={!radioConfigured} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-900 text-neutral-300 disabled:opacity-30"><Heart className="h-4 w-4" /></button>
                <button onClick={() => feedFmRadio.dislike()} disabled={!radioConfigured} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-900 text-neutral-300 disabled:opacity-30"><ThumbsDown className="h-4 w-4" /></button>
                <div className="ml-auto flex items-center gap-2 text-neutral-400"><Volume2 className="h-4 w-4" /><input aria-label="Music volume" type="range" min="0" max="100" value={radio.volume} onChange={(e) => feedFmRadio.setVolume(Number(e.target.value))} className="w-28 accent-[#ff5500]" /></div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-neutral-800 bg-neutral-950/70 p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Stations</div>
            <div className="mt-4 space-y-2">
              {radio.stations.length ? radio.stations.map((station) => (
                <div key={station.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="text-sm font-bold text-white">{station.name}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">Licensed station</div>
                </div>
              )) : <EmptyState text="Stations appear here after Feed.fm credentials are connected and territory checks complete." />}
            </div>
          </div>
        </div>
      )}

      {mode === 'clips' && (
        <div className="rounded-[24px] border border-neutral-800 bg-neutral-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Feed Clips</div><h2 className="mt-1 text-2xl font-black text-white">Licensed soundtrack library</h2></div>
            {collections.length > 0 && <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white">{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}{collection.rating ? ` · ${collection.rating}` : ''}</option>)}</select>}
          </div>

          {!clipsConfigured ? <div className="mt-6"><EmptyState text="Feed Clips is integrated but locked until VITE_FEED_CLIPS_TOKEN is configured. NRN-owned soundtrack tools can continue working independently." /></div> : loadingClips ? <div className="mt-6 text-sm text-neutral-500">Loading licensed clips…</div> : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clips.map((clip) => <button key={clip.id} onClick={() => previewClip(clip)} className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-left hover:border-[#ff5500]/50"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#ff5500]/10 text-[#ff5500]"><Play className="h-4 w-4 fill-current" /></div><div className="min-w-0"><div className="truncate text-sm font-black text-white">{clip.title ?? 'Licensed clip'}</div><div className="truncate text-xs text-neutral-500">{clip.artist ?? 'Feed Clips'}</div></div></div><div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-600">{clip.explicitness ?? 'rating unknown'}{clip.duration ? ` · ${Math.round(clip.duration)}s` : ''}</div></button>)}
            </div>
          )}
          {clipsMessage && <p className="mt-4 text-xs text-amber-300">{clipsMessage}</p>}
        </div>
      )}

      {mode === 'creator' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <CreatorCard title="Short Drama Soundtrack" copy="Select a licensed clip, preview it against a scene, keep dialogue on an independent audio bus, then attach the music selection to the project metadata for reporting." steps={['Choose scene', 'Browse mood/collection', 'Preview licensed clip', 'Mix dialogue + music', 'Attach + report usage']} />
          <CreatorCard title="NRN Creator Music Router" copy="Route every project to the right music source: NRN-owned tracks for maximum freedom, Feed Clips for licensed short-form sync, or Feed Radio for continuous background experiences." steps={['Identify media type', 'Check rights/territory', 'Select provider', 'Render or stream', 'Track engagement + rights events']} />
        </div>
      )}
    </section>
  );
}

function Capability({ icon: Icon, title, copy }: { icon: typeof ShieldCheck; title: string; copy: string }) {
  return <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5"><Icon className="h-5 w-5 text-[#ff5500]" /><h3 className="mt-3 text-sm font-black text-white">{title}</h3><p className="mt-2 text-xs leading-5 text-neutral-500">{copy}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-5 text-xs leading-5 text-neutral-500">{text}</div>;
}

function CreatorCard({ title, copy, steps }: { title: string; copy: string; steps: string[] }) {
  return <div className="rounded-[24px] border border-neutral-800 bg-neutral-950/70 p-6"><Film className="h-6 w-6 text-[#ff5500]" /><h3 className="mt-4 text-xl font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-400">{copy}</p><div className="mt-5 flex flex-wrap gap-2">{steps.map((step, index) => <span key={step} className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{index + 1}. {step}</span>)}</div></div>;
}

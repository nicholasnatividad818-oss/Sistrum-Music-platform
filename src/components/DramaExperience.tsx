import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clapperboard,
  Clock,
  Eye,
  Film,
  Heart,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound
} from 'lucide-react';
import { MOCK_DRAMAS } from '../data/mockDramas';
import { DramaSeries, DramaSubmission } from '../dramaTypes';

const formatCount = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function DramaExperience() {
  const [selectedId, setSelectedId] = useState(MOCK_DRAMAS[0].id);
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [genre, setGenre] = useState('All');

  const selected = MOCK_DRAMAS.find((series) => series.id === selectedId) || MOCK_DRAMAS[0];
  const activeEpisode = selected.episodes[Math.min(episodeIndex, selected.episodes.length - 1)];
  const genres = ['All', ...Array.from(new Set(MOCK_DRAMAS.map((series) => series.genre)))];
  const filtered = useMemo(
    () => (genre === 'All' ? MOCK_DRAMAS : MOCK_DRAMAS.filter((series) => series.genre === genre)),
    [genre]
  );

  const selectSeries = (series: DramaSeries) => {
    setSelectedId(series.id);
    setEpisodeIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submission: DramaSubmission = {
      id: `submission-${Date.now()}`,
      title: String(form.get('title') || ''),
      directorName: String(form.get('directorName') || ''),
      email: String(form.get('email') || ''),
      logline: String(form.get('logline') || ''),
      screenerUrl: String(form.get('screenerUrl') || ''),
      format: (String(form.get('format') || 'vertical') as DramaSubmission['format']),
      rightsConfirmed: form.get('rightsConfirmed') === 'on',
      submittedAt: new Date().toISOString()
    };

    const existing = JSON.parse(localStorage.getItem('nrn_drama_submissions') || '[]') as DramaSubmission[];
    localStorage.setItem('nrn_drama_submissions', JSON.stringify([submission, ...existing]));
    setSubmitted(true);
    event.currentTarget.reset();
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-white selection:bg-[#ff5500] selection:text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#09090d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { window.location.hash = ''; }}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Back to Sistrum"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5500] shadow-lg shadow-[#ff5500]/20">
                <Clapperboard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ff7a45]">NRN Platform</div>
                <div className="text-sm font-black tracking-tight">SHORT DRAMAS</div>
              </div>
            </div>
          </div>
          <a
            href="#submit-drama"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-black transition hover:bg-neutral-200"
          >
            <Upload className="h-4 w-4" /> Submit a series
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8">
        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 min-h-[420px]">
            <img src={selected.posterUrl} alt={selected.title} className="absolute inset-0 h-full w-full object-cover opacity-45" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />
            <div className="relative flex h-full min-h-[420px] max-w-2xl flex-col justify-end p-7 sm:p-10">
              <div className="mb-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                <span className="rounded-full bg-[#ff5500] px-3 py-1">Featured Independent</span>
                <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1">{selected.genre}</span>
                <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1">{selected.episodeCount} episodes</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{selected.title}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-300">{selected.synopsis}</p>
              <div className="mt-5 flex items-center gap-3">
                <img src={selected.director.avatar} alt={selected.director.name} className="h-10 w-10 rounded-full border border-white/20 object-cover" />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    Directed by {selected.director.name}
                    {selected.director.isVerified && <BadgeCheck className="h-4 w-4 text-[#ff6a2a]" />}
                  </div>
                  <div className="text-[11px] text-neutral-400">@{selected.director.handle} · {selected.director.location}</div>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Rights readiness</div>
            <div className="space-y-3 text-xs">
              {[
                ['Creator owns project', selected.rights.creatorOwned],
                ['Music cleared', selected.rights.musicCleared],
                ['Talent releases', selected.rights.talentReleases],
                ['Ready for licensing', selected.rights.licenseReady]
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2.5">
                  <span className="text-neutral-300">{label}</span>
                  <span className={ok ? 'text-emerald-400' : 'text-amber-400'}>{ok ? 'Verified' : 'Pending'}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black/30 p-3"><Eye className="mx-auto mb-1 h-4 w-4 text-neutral-400" /><div className="text-sm font-black">{formatCount(selected.stats.views)}</div><div className="text-[9px] uppercase text-neutral-500">Views</div></div>
              <div className="rounded-xl bg-black/30 p-3"><Heart className="mx-auto mb-1 h-4 w-4 text-neutral-400" /><div className="text-sm font-black">{formatCount(selected.stats.likes)}</div><div className="text-[9px] uppercase text-neutral-500">Likes</div></div>
              <div className="rounded-xl bg-black/30 p-3"><Save className="mx-auto mb-1 h-4 w-4 text-neutral-400" /><div className="text-sm font-black">{formatCount(selected.stats.saves)}</div><div className="text-[9px] uppercase text-neutral-500">Saves</div></div>
            </div>
          </aside>
        </section>

        <section className="mb-12 grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl shadow-black/60">
              <div className="relative aspect-[9/16] bg-neutral-950">
                {activeEpisode?.videoUrl ? (
                  <video
                    key={activeEpisode.id}
                    controls
                    playsInline
                    poster={selected.posterUrl}
                    className="h-full w-full object-cover"
                    src={activeEpisode.videoUrl}
                  />
                ) : (
                  <img src={selected.posterUrl} alt="Episode poster" className="h-full w-full object-cover" />
                )}
                <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                  Episode {activeEpisode?.number || 1}
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-neutral-500">Prototype player uses a CC0 sample clip until director-owned media storage is connected.</p>
          </div>

          <div>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6a2a]">Now playing</div>
                <h2 className="mt-1 text-2xl font-black">{activeEpisode?.title || selected.title}</h2>
                <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {activeEpisode?.durationSeconds || selected.averageEpisodeSeconds}s</span>
                  <span>{selected.language}</span><span>{selected.ageRating}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {selected.episodes.map((episode, index) => (
                <button
                  key={episode.id}
                  onClick={() => setEpisodeIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${index === episodeIndex ? 'border-[#ff5500]/60 bg-[#ff5500]/10' : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/40"><Play className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{episode.number}. {episode.title}</div><div className="mt-1 text-[10px] text-neutral-500">{episode.durationSeconds}s · {episode.isFree ? 'Free episode' : 'Member episode'}</div></div>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-3">
                <img src={selected.director.avatar} alt={selected.director.name} className="h-14 w-14 rounded-2xl object-cover" />
                <div><div className="flex items-center gap-1.5 font-black">{selected.director.name}{selected.director.isVerified && <BadgeCheck className="h-4 w-4 text-[#ff6a2a]" />}</div><div className="text-xs text-neutral-500">Independent director · {selected.director.location}</div></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-neutral-400">{selected.director.bio}</p>
            </div>
          </div>
        </section>

        <section className="mb-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6a2a]">Discover</div><h2 className="mt-1 text-2xl font-black">Independent micro-series</h2></div>
            <div className="flex flex-wrap gap-2">{genres.map((item) => <button key={item} onClick={() => setGenre(item)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${genre === item ? 'bg-white text-black' : 'bg-white/5 text-neutral-400 hover:bg-white/10'}`}>{item}</button>)}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((series) => (
              <button key={series.id} onClick={() => selectSeries(series)} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] text-left transition hover:-translate-y-1 hover:border-white/20">
                <div className="relative aspect-[3/4] overflow-hidden"><img src={series.posterUrl} alt={series.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" /><span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[9px] font-black uppercase">{series.genre}</span><div className="absolute bottom-3 left-3 right-3"><div className="text-lg font-black">{series.title}</div><div className="mt-1 text-[10px] text-neutral-300">Director {series.director.name}</div></div></div>
                <div className="p-3 text-[10px] text-neutral-500">{series.episodeCount} eps · ~{series.averageEpisodeSeconds}s each · {series.status}</div>
              </button>
            ))}
          </div>
        </section>

        <section id="submit-drama" className="rounded-[2rem] border border-[#ff5500]/25 bg-gradient-to-br from-[#1a0c07] to-[#0b0b0f] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff5500]"><Film className="h-5 w-5" /></div>
              <h2 className="mt-5 text-3xl font-black">Submit your short drama to NRN</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">Built for independent directors who want attribution, a series page, audience data, and a path to licensing without giving up ownership by default.</p>
              <div className="mt-5 space-y-2 text-xs text-neutral-300">
                <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> Mobile-first vertical or adaptable footage</div>
                <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> Clear chain of title, music rights, and talent releases</div>
                <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> Strong hook, serialized story, and director credit</div>
              </div>
            </div>

            <form onSubmit={submitProject} className="grid gap-3 sm:grid-cols-2">
              <input required name="title" placeholder="Series title" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#ff5500]" />
              <input required name="directorName" placeholder="Director name" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#ff5500]" />
              <input required type="email" name="email" placeholder="Contact email" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#ff5500]" />
              <select name="format" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#ff5500]"><option value="vertical">Vertical 9:16</option><option value="horizontal">Horizontal</option><option value="mixed">Mixed / adaptable</option></select>
              <input required type="url" name="screenerUrl" placeholder="Private screener URL" className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#ff5500]" />
              <textarea required name="logline" rows={4} placeholder="One-sentence logline" className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#ff5500]" />
              <label className="sm:col-span-2 flex items-start gap-2 text-xs text-neutral-400"><input required type="checkbox" name="rightsConfirmed" className="mt-0.5" /> I confirm I control the rights necessary to submit this project for review.</label>
              <button className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-5 py-3 text-sm font-black transition hover:bg-[#ff6a20]"><Sparkles className="h-4 w-4" /> Send project for review</button>
              {submitted && <div className="sm:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">Submission saved locally in this prototype. The production version should send this into Supabase with review status, media assets, and rights documents.</div>}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

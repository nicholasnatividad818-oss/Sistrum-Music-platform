import { useState } from 'react';
import { Sparkles, Image as ImageIcon, Mic2, Loader2 } from 'lucide-react';
import { generateSistrum, GenerateError, GENERATE_GENRES } from '../services/generate';

export interface GenerateStudioValues {
  title: string;
  artist: string;
  genre: string;
  mood: string;
  theme: string;
  lyrics: string;
  coverArt: string;
}

interface GenerateStudioProps {
  initial?: Partial<GenerateStudioValues>;
  submitLabel: string;
  onSubmit: (values: GenerateStudioValues) => void;
}

export function GenerateStudio({ initial, submitLabel, onSubmit }: GenerateStudioProps) {
  const [title, setTitle] = useState(initial?.title || '');
  const [artist, setArtist] = useState(initial?.artist || 'NRN');
  const [genre, setGenre] = useState(initial?.genre || 'Synthwave');
  const [mood, setMood] = useState(initial?.mood || '');
  const [theme, setTheme] = useState(initial?.theme || '');
  const [lyrics, setLyrics] = useState(initial?.lyrics || '');
  const [coverArt, setCoverArt] = useState(initial?.coverArt || '');
  const [busy, setBusy] = useState<'lyrics' | 'cover' | 'both' | null>(null);
  const [error, setError] = useState('');

  const payload = { title, artist, genre, mood, theme, lyrics };

  const run = async (kind: 'lyrics' | 'cover' | 'both') => {
    setError('');
    if (!title.trim()) {
      setError('Give the track a title first.');
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'lyrics' || kind === 'both') {
        const result = await generateSistrum({ kind: 'lyrics', ...payload });
        if (result.kind === 'lyrics') setLyrics(result.lyrics);
      }
      if (kind === 'cover' || kind === 'both') {
        const latestLyrics = kind === 'both' ? undefined : lyrics;
        const result = await generateSistrum({
          kind: 'cover',
          ...payload,
          lyrics: kind === 'both' ? undefined : latestLyrics
        });
        if (result.kind === 'cover') setCoverArt(result.imageDataUrl);
      }
    } catch (err) {
      const message = err instanceof GenerateError ? err.message : 'Generation failed.';
      setError(message);
    } finally {
      setBusy(null);
    }
  };

  const handleCoverAfterLyrics = async () => {
    setError('');
    if (!title.trim()) {
      setError('Give the track a title first.');
      return;
    }
    setBusy('both');
    try {
      let nextLyrics = lyrics;
      if (!nextLyrics.trim()) {
        const result = await generateSistrum({ kind: 'lyrics', ...payload });
        if (result.kind === 'lyrics') {
          nextLyrics = result.lyrics;
          setLyrics(nextLyrics);
        }
      }
      const cover = await generateSistrum({ kind: 'cover', ...payload, lyrics: nextLyrics });
      if (cover.kind === 'cover') setCoverArt(cover.imageDataUrl);
    } catch (err) {
      setError(err instanceof GenerateError ? err.message : 'Generation failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-300 block mb-1">Title *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Midnight Grid Run"
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-300 block mb-1">Artist</span>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-300 block mb-1">Genre</span>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none"
          >
            {GENERATE_GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-300 block mb-1">Mood</span>
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="Neon rain, late-night drive"
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-neutral-300 block mb-1">Theme / story</span>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="What the song is actually about"
          className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('lyrics')}
          className="px-3.5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
        >
          {busy === 'lyrics' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic2 className="w-3.5 h-3.5" />}
          Write lyrics
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('cover')}
          className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
        >
          {busy === 'cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
          Generate cover
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={handleCoverAfterLyrics}
          className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-700 hover:border-[#ff5500] disabled:opacity-50 text-neutral-200 text-xs font-bold flex items-center gap-1.5"
        >
          {busy === 'both' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#ff5500]" />}
          Lyrics + cover
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-neutral-300 block mb-1">Lyrics</label>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={14}
            placeholder={'[Verse 1]\n...'}
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-3 text-xs text-white font-mono leading-relaxed focus:border-[#ff5500] outline-none resize-y min-h-[220px]"
          />
        </div>
        <div>
          <span className="text-xs font-semibold text-neutral-300 block mb-1">Cover</span>
          <div className="aspect-square rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 flex items-center justify-center">
            {coverArt ? (
              <img src={coverArt} alt="Generated cover" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center px-4">
                <ImageIcon className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-[11px] text-neutral-500">1:1 Gemini cover</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!title.trim() || (!lyrics.trim() && !coverArt)}
          onClick={() =>
            onSubmit({ title: title.trim(), artist: artist.trim() || 'NRN', genre, mood, theme, lyrics, coverArt })
          }
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-40 text-neutral-950 text-xs font-bold flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-[#ff5500]" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

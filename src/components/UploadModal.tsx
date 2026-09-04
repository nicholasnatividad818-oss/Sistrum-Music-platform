import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { Track, UserProfile } from '../types';
import { audioEngine } from '../services/audioEngine';
import { publishTrack } from '../services/platform';
import { Waveform } from './Waveform';
import { BeatMakerStudio } from './BeatMakerStudio';
import confetti from 'canvas-confetti';
import { Upload, Music, Image as ImageIcon, Sparkles, X, Check, Disc, Play, Pause, Layers, Loader2 } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackCreated: () => Promise<void> | void;
  user: User | null;
  profile: UserProfile | null;
  onRequireAuth: () => void;
}

export function UploadModal({ isOpen, onClose, onTrackCreated, user, profile, onRequireAuth }: UploadModalProps) {
  const [activeMode, setActiveMode] = useState<'upload' | 'studio'>('upload');
  
  // Upload State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [extractedWaveform, setExtractedWaveform] = useState<number[]>([]);
  const [extractedDuration, setExtractedDuration] = useState(180);

  // Metadata
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState(profile?.displayName || '');
  const [genre, setGenre] = useState('Electronic');
  const [tagsInput, setTagsInput] = useState('Synth, Beats, 2026');
  const [description, setDescription] = useState('');
  const [coverArtUrl, setCoverArtUrl] = useState('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Preview playback
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.displayName) setArtist(profile.displayName);
  }, [profile?.displayName]);

  if (!isOpen) return null;

  const handleAudioSelection = async (file: File) => {
    setPublishError('');
    if (file.size > 100 * 1024 * 1024) {
      setPublishError('Audio files are limited to 100 MB during the private beta.');
      return;
    }
    if (!file.type.startsWith('audio/')) {
      setPublishError('Choose a supported audio file.');
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setIsDecoding(true);

    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }

    try {
      const { waveform, duration } = await SoundEngineExtract(file);
      setExtractedWaveform(waveform);
      setExtractedDuration(duration);
    } catch {
      // Fallback procedural waveform if audio decode fails
      const fallback: number[] = [];
      for (let i = 0; i < 75; i++) {
        fallback.push(0.2 + Math.abs(Math.sin(i * 0.3)) * 0.7);
      }
      setExtractedWaveform(fallback);
      setExtractedDuration(180);
    } finally {
      setIsDecoding(false);
    }
  };

  const SoundEngineExtract = async (file: File) => {
    return await SoundEngineHelper(file);
  };

  const SoundEngineHelper = async (file: File) => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AudioContextClass();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;
    const numBars = 75;
    const blockSize = Math.floor(channelData.length / numBars);
    const waveform: number[] = [];

    for (let i = 0; i < numBars; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      const avg = sum / blockSize;
      waveform.push(Number(Math.min(1.0, Math.max(0.18, avg * 3.8)).toFixed(2)));
    }
    tempCtx.close();
    return { waveform, duration };
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
        handleAudioSelection(file);
      }
    }
  };

  const handleCoverUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setPublishError('Artwork is limited to 10 MB.');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
        setPublishError('Artwork must be JPEG, PNG, WebP, or AVIF.');
        return;
      }
      const url = URL.createObjectURL(file);
      setCoverFile(file);
      setCoverArtUrl(url);
    }
  };

  const coverPresets = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80'
  ];

  const handlePublishUploadedTrack = async () => {
    if (!user) {
      onClose();
      onRequireAuth();
      return;
    }
    if (!title.trim() || !audioFile || !rightsConfirmed) return;
    setIsPublishing(true);
    setPublishError('');
    try {
      await publishTrack({
        user,
        profile,
        title,
        artist,
        genre,
        tags: tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
        description,
        duration: extractedDuration,
        waveformData: extractedWaveform,
        audioFile,
        coverFile,
        coverPresetUrl: coverFile ? undefined : coverArtUrl,
        bpm: 0,
        synthPreset: genre === 'Lo-Fi' ? 'lofi' : genre === 'House' ? 'house' : genre === 'Ambient' ? 'ambient' : 'synthwave',
      });
      await onTrackCreated();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      onClose();
    } catch (caught) {
      setPublishError(caught instanceof Error ? caught.message : 'Unable to publish this track.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStudioPublish = async (trackData: Partial<Track>) => {
    if (!user) {
      onClose();
      onRequireAuth();
      return;
    }
    setIsPublishing(true);
    setPublishError('');
    try {
      await publishTrack({
        user,
        profile,
        title: trackData.title || 'Studio Composition',
        artist: profile?.displayName || artist || 'Sistrum Artist',
        genre: trackData.genre || 'Electronic',
        tags: ['Sequencer', 'Original', 'Sistrum Studio'],
        description: 'Created with the Sistrum Beat Maker Sequencer.',
        duration: trackData.duration || 180,
        waveformData: trackData.waveformData || [0.4, 0.6, 0.8, 0.5, 0.7],
        coverPresetUrl: trackData.coverArt || coverPresets[0],
        bpm: trackData.bpm || 128,
        synthPreset: trackData.synthPreset || 'synthwave',
      });
      await onTrackCreated();
      onClose();
    } catch (caught) {
      setPublishError(caught instanceof Error ? caught.message : 'Unable to publish this composition.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff5500] flex items-center justify-center text-white font-bold shadow-lg shadow-[#ff5500]/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Sistrum Creator Studio</h2>
              <p className="text-xs text-neutral-400">Upload audio files or create custom beats in browser</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center bg-neutral-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveMode('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeMode === 'upload' ? 'bg-[#ff5500] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setActiveMode('studio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeMode === 'studio' ? 'bg-[#ff5500] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Beat Sequencer
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeMode === 'studio' ? (
          <div className="p-6">
            <BeatMakerStudio onPublishTrack={handleStudioPublish} onClose={onClose} />
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Upload Drop Zone */}
            {!audioFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-700 hover:border-[#ff5500] rounded-2xl p-8 text-center cursor-pointer transition-all bg-neutral-950/40 hover:bg-neutral-950/80 group flex flex-col items-center justify-center space-y-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleAudioSelection(e.target.files[0])}
                  accept="audio/*,.mp3,.wav,.ogg,.aac,.flac"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-neutral-800 group-hover:bg-[#ff5500]/20 group-hover:text-[#ff5500] text-neutral-400 flex items-center justify-center transition-colors">
                  <Music className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white mb-1">Drag and drop your audio file here</h4>
                  <p className="text-xs text-neutral-400">Supports common audio formats up to 100 MB</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-[#ff5500] text-white text-xs font-bold shadow-md shadow-[#ff5500]/20 group-hover:bg-[#ff6611]"
                >
                  Choose File from Computer
                </button>
              </div>
            ) : (
              <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white truncate max-w-xs">{audioFile.name}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {Math.round(extractedDuration)}s duration
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioFile(null);
                      setAudioUrl(null);
                      setExtractedWaveform([]);
                    }}
                    className="text-xs text-neutral-400 hover:text-rose-400"
                  >
                    Change File
                  </button>
                </div>

                {/* Extracted Waveform Preview */}
                {isDecoding ? (
                  <div className="h-16 flex items-center justify-center gap-2 text-xs text-[#ff5500] font-medium animate-pulse">
                    <Sparkles className="w-4 h-4" />
                    <span>Extracting audio peak waveform data...</span>
                  </div>
                ) : (
                  <div className="pt-2">
                    <Waveform
                      waveformData={extractedWaveform}
                      duration={extractedDuration}
                      currentTime={previewTime}
                      onSeek={(sec) => setPreviewTime(sec)}
                      height={48}
                      showComments={false}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Track Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cover Art Box */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                  Artwork
                </label>
                <div className="relative group rounded-2xl overflow-hidden border border-neutral-700 aspect-square">
                  <img src={coverArtUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity text-xs font-semibold gap-1"
                  >
                    <ImageIcon className="w-6 h-6" />
                    <span>Change Image</span>
                  </div>
                  <input
                    type="file"
                    ref={coverInputRef}
                    onChange={handleCoverUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Preset art swatches */}
                <div className="flex gap-1.5 overflow-x-auto py-1">
                  {coverPresets.map((preset, idx) => (
                    <img
                      key={idx}
                      src={preset}
                      alt="Preset"
                      onClick={() => setCoverArtUrl(preset)}
                      onMouseDown={() => setCoverFile(null)}
                      className={`w-8 h-8 rounded-lg object-cover cursor-pointer border-2 transition-all ${
                        coverArtUrl === preset ? 'border-[#ff5500] scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Form Info */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Track Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your track a title..."
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">Artist Name</label>
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">Main Genre</label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#ff5500] outline-none"
                    >
                      <option value="Electronic">Electronic</option>
                      <option value="Synthwave">Synthwave</option>
                      <option value="Lo-Fi">Lo-Fi</option>
                      <option value="House">House</option>
                      <option value="Ambient">Ambient</option>
                      <option value="Trap">Trap</option>
                      <option value="Future Bass">Future Bass</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Synth, Beats, Chill, Sunset..."
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2 text-xs text-white focus:border-[#ff5500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Track Story / Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell your listeners about the production, gear used, or inspiration..."
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2 text-xs text-white focus:border-[#ff5500] outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <label className="flex max-w-sm items-start gap-2 text-xs text-neutral-400">
                <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-0.5 accent-[#ff5500]" />
                <span>I own or control the rights to this audio and artwork and agree to publish it publicly on Sistrum.</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="publish-track-btn"
                  onClick={handlePublishUploadedTrack}
                  disabled={!title.trim() || !audioFile || !rightsConfirmed || isPublishing || isDecoding}
                  className="px-6 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/25 flex items-center gap-2"
                >
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{isPublishing ? 'Publishing…' : 'Publish Track'}</span>
                </button>
              </div>
            </div>
            {publishError && (
              <div role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-200">
                {publishError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

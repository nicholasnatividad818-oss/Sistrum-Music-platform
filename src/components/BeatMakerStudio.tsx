import { useState, useEffect, useRef } from 'react';
import { Track } from '../types';
import confetti from 'canvas-confetti';
import { Play, Pause, RotateCcw, Sparkles, Upload, Music, Volume2, Save, Wand2 } from 'lucide-react';

interface BeatMakerStudioProps {
  onPublishTrack: (track: Partial<Track>) => void;
  onClose?: () => void;
}

export function BeatMakerStudio({ onPublishTrack, onClose }: BeatMakerStudioProps) {
  const [bpm, setBpm] = useState(128);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [trackTitle, setTrackTitle] = useState('My Studio Beat #1');
  const [selectedGenre, setSelectedGenre] = useState('Electronic');

  // 16-step tracks for 6 instruments
  const [grid, setGrid] = useState({
    kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    clap: [false, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false],
    bass: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false],
    lead: [false, false, true, false, false, false, true, false, false, false, true, false, false, true, false, false]
  });

  const intervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playSound = (type: string, time: number) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (type === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.16);
    } else if (type === 'snare') {
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(time);
    } else if (type === 'hihat') {
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(time);
    } else if (type === 'clap') {
      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(time);
    } else if (type === 'bass') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65.41, time); // C2
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, time);
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.22);
    } else if (type === 'lead') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
      osc.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], time);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.2);
    }
  };

  const togglePad = (instrument: keyof typeof grid, stepIdx: number) => {
    setGrid((prev) => ({
      ...prev,
      [instrument]: prev[instrument].map((active, idx) => (idx === stepIdx ? !active : active))
    }));
  };

  // Playback step loop
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const stepMs = (60 / bpm / 4) * 1000;
    const ctx = getAudioContext();

    intervalRef.current = window.setInterval(() => {
      setCurrentStep((prev) => {
        const nextStep = (prev + 1) % 16;
        const time = ctx ? ctx.currentTime + 0.02 : 0;

        if (grid.kick[nextStep]) playSound('kick', time);
        if (grid.snare[nextStep]) playSound('snare', time);
        if (grid.hihat[nextStep]) playSound('hihat', time);
        if (grid.clap[nextStep]) playSound('clap', time);
        if (grid.bass[nextStep]) playSound('bass', time);
        if (grid.lead[nextStep]) playSound('lead', time);

        return nextStep;
      });
    }, stepMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, bpm, grid]);

  const loadPreset = (presetName: string) => {
    if (presetName === 'synthwave') {
      setBpm(124);
      setSelectedGenre('Synthwave');
      setGrid({
        kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
        clap: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        bass: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
        lead: [true, false, false, true, false, true, false, false, true, false, true, false, false, true, false, false]
      });
    } else if (presetName === 'lofi') {
      setBpm(84);
      setSelectedGenre('Lo-Fi');
      setGrid({
        kick: [true, false, false, false, false, false, false, true, false, false, true, false, false, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [true, false, true, true, false, true, true, false, true, false, true, true, false, true, true, false],
        clap: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        bass: [true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false],
        lead: [false, false, true, false, false, false, false, false, true, false, false, false, false, false, true, false]
      });
    } else if (presetName === 'house') {
      setBpm(126);
      setSelectedGenre('House');
      setGrid({
        kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        snare: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        hihat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
        clap: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        bass: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
        lead: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false]
      });
    }
  };

  const handlePublish = () => {
    setIsPlaying(false);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Generate waveform from active steps
    const bars: number[] = [];
    for (let i = 0; i < 75; i++) {
      const step = i % 16;
      let power = 0.2;
      if (grid.kick[step]) power += 0.35;
      if (grid.snare[step] || grid.clap[step]) power += 0.25;
      if (grid.lead[step]) power += 0.2;
      bars.push(Math.min(1.0, power + (Math.sin(i * 0.5) * 0.1)));
    }

    const coverImages = [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'
    ];

    onPublishTrack({
      title: trackTitle || 'Untitled Beat',
      genre: selectedGenre,
      bpm: bpm,
      duration: 180,
      waveformData: bars,
      coverArt: coverImages[Math.floor(Math.random() * coverImages.length)],
      synthPreset: selectedGenre === 'Lo-Fi' ? 'lofi' : selectedGenre === 'House' ? 'house' : 'synthwave'
    });
  };

  type InstrumentKey = 'kick' | 'snare' | 'hihat' | 'clap' | 'bass' | 'lead';
  const instruments: { id: InstrumentKey; label: string; color: string }[] = [
    { id: 'kick', label: 'Kick Drum', color: 'bg-rose-500 text-white' },
    { id: 'snare', label: 'Snare Snap', color: 'bg-amber-500 text-white' },
    { id: 'hihat', label: 'Hi-Hat 16th', color: 'bg-emerald-500 text-white' },
    { id: 'clap', label: 'Hand Clap', color: 'bg-cyan-500 text-white' },
    { id: 'bass', label: 'Sub-Bass 808', color: 'bg-indigo-500 text-white' },
    { id: 'lead', label: 'Synth Lead', color: 'bg-[#ff5500] text-white' }
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ff5500]/20 flex items-center justify-center text-[#ff5500]">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">SoundWave Beat Maker & Sequencer</h3>
            <p className="text-xs text-neutral-400">Compose interactive 16-step patterns directly in your browser</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            id="beat-play-btn"
            onClick={() => {
              getAudioContext();
              setIsPlaying(!isPlaying);
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-neutral-950'
                : 'bg-[#ff5500] hover:bg-[#ff6611] text-white shadow-[#ff5500]/20'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Pause Loop' : 'Play Beat Loop'}</span>
          </button>

          <button
            id="publish-beat-btn"
            onClick={handlePublish}
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md"
          >
            <Sparkles className="w-4 h-4 text-[#ff5500]" />
            <span>Publish to Stream</span>
          </button>
        </div>
      </div>

      {/* Preset & BPM Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-neutral-800/80">
        {/* Track Title Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-xs font-semibold text-neutral-400">Track Name:</span>
          <input
            type="text"
            value={trackTitle}
            onChange={(e) => setTrackTitle(e.target.value)}
            className="bg-neutral-950 border border-neutral-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:border-[#ff5500] outline-none flex-1 font-medium"
            placeholder="Name your track..."
          />
        </div>

        {/* Presets */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-400">Presets:</span>
          <button
            onClick={() => loadPreset('synthwave')}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300"
          >
            Synthwave
          </button>
          <button
            onClick={() => loadPreset('lofi')}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300"
          >
            Lo-Fi
          </button>
          <button
            onClick={() => loadPreset('house')}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300"
          >
            House
          </button>
        </div>

        {/* BPM Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-400">BPM:</span>
          <input
            type="range"
            min="60"
            max="160"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-24 accent-[#ff5500] cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-white w-8">{bpm}</span>
        </div>
      </div>

      {/* Sequencer Grid */}
      <div className="pt-6 space-y-3 overflow-x-auto">
        {/* Step Numbers Indicator */}
        <div className="flex items-center gap-2 pl-32 min-w-[620px]">
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 text-center font-mono text-[10px] ${
                currentStep === idx && isPlaying
                  ? 'text-[#ff5500] font-bold scale-110'
                  : idx % 4 === 0
                  ? 'text-neutral-300 font-semibold'
                  : 'text-neutral-600'
              }`}
            >
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Instrument Rows */}
        {instruments.map((inst) => {
          const rowSteps = grid[inst.id];
          return (
            <div key={inst.id} className="flex items-center gap-2 min-w-[620px]">
              {/* Instrument Label */}
              <div className="w-30 flex items-center justify-between pr-2">
                <span className="text-xs font-medium text-neutral-300 truncate">{inst.label}</span>
                <button
                  onClick={() => playSound(inst.id, getAudioContext()?.currentTime || 0)}
                  className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white"
                  title="Test Sound"
                >
                  <Volume2 className="w-3 h-3" />
                </button>
              </div>

              {/* 16 Step Pads */}
              <div className="flex-1 grid grid-cols-16 gap-1.5">
                {rowSteps.map((isActive, stepIdx) => {
                  const isCurrent = currentStep === stepIdx && isPlaying;
                  const isBarStart = stepIdx % 4 === 0;

                  return (
                    <button
                      key={stepIdx}
                      id={`pad-${inst.id}-${stepIdx}`}
                      onClick={() => togglePad(inst.id, stepIdx)}
                      className={`h-9 rounded-md transition-all flex items-center justify-center border ${
                        isActive
                          ? `${inst.color} border-transparent shadow-sm scale-100`
                          : isBarStart
                          ? 'bg-neutral-800/90 border-neutral-700/60 hover:bg-neutral-700'
                          : 'bg-neutral-950 border-neutral-800/80 hover:bg-neutral-800'
                      } ${isCurrent ? 'ring-2 ring-white scale-105 z-10' : ''}`}
                    >
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

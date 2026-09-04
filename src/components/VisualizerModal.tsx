import { useEffect, useRef, useState } from 'react';
import { Track, Comment } from '../types';
import { audioEngine } from '../services/audioEngine';
import { X, Play, Pause, SkipBack, SkipForward, Volume2, Maximize2, Radio, MessageSquare } from 'lucide-react';

interface VisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  comments?: Comment[];
}

export function VisualizerModal({
  isOpen,
  onClose,
  track,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentTime,
  duration,
  comments = []
}: VisualizerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visualMode, setVisualMode] = useState<'bars' | 'circle' | 'wave'>('bars');
  const [activeComment, setActiveComment] = useState<Comment | null>(null);

  // Sync active timed comment when audio passes timestamp (within 2.5 seconds)
  useEffect(() => {
    if (!isOpen) return;
    const match = comments.find(
      (c) => Math.abs(c.timestamp - currentTime) <= 2.0
    );
    setActiveComment(match || null);
  }, [currentTime, comments, isOpen]);

  // Audio reactive canvas render loop
  useEffect(() => {
    if (!isOpen) return;

    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const freqData = audioEngine.getFrequencyData();

      // Semi-transparent background clear for smooth motion trails
      ctx.fillStyle = 'rgba(10, 10, 15, 0.25)';
      ctx.fillRect(0, 0, width, height);

      if (visualMode === 'bars') {
        // Classic Spectrum Bars with Neon Gradients
        const numBars = 64;
        const barWidth = (width / numBars) * 0.8;
        const gap = (width / numBars) * 0.2;

        for (let i = 0; i < numBars; i++) {
          const val = freqData[i] || 0;
          const barHeight = (val / 255) * (height * 0.55);
          const x = i * (barWidth + gap) + gap / 2;
          const y = height - barHeight - 120;

          // Gradient from orange to vibrant amber/pink
          const grad = ctx.createLinearGradient(x, y, x, height - 120);
          grad.addColorStop(0, '#ff7700');
          grad.addColorStop(0.5, '#ff3300');
          grad.addColorStop(1, '#ffaa00');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          // Peak cap glow
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y - 3, barWidth, 2);
        }
      } else if (visualMode === 'circle') {
        // Circular Galactic Bass Orb
        const centerX = width / 2;
        const centerY = height / 2 - 40;
        const baseRadius = Math.min(width, height) * 0.18;
        const numPoints = 64;

        // Calculate average bass intensity for central pulsing
        let bassSum = 0;
        for (let i = 0; i < 10; i++) bassSum += freqData[i] || 0;
        const bassIntensity = (bassSum / 10) / 255;

        // Outer glow circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + (bassIntensity * 30), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 85, 0, ${0.15 + bassIntensity * 0.2})`;
        ctx.fill();
        ctx.restore();

        // Radiating Frequency Spike Circle
        ctx.beginPath();
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const val = freqData[i % freqData.length] || 0;
          const r = baseRadius + (val / 255) * 110;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = '#ff5500';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Smooth Oscilloscope Wave
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff6600';
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 15;

        const sliceWidth = width / freqData.length;
        let x = 0;

        for (let i = 0; i < freqData.length; i++) {
          const v = freqData[i] / 128.0;
          const y = (v * (height / 4)) + (height / 2) - 80;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [isOpen, visualMode]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08080c] flex flex-col justify-between overflow-hidden animate-in fade-in select-none">
      {/* Background Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ff5500] flex items-center justify-center text-white shadow-lg shadow-[#ff5500]/30 font-black">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-[#ff5500] font-bold">Sistrum Studio</div>
            <div className="text-white text-sm font-semibold">Live Spectrum Analyzer</div>
          </div>
        </div>

        {/* Visualizer Mode Toggles */}
        <div className="flex items-center gap-2 bg-neutral-900/70 backdrop-blur-md p-1.5 rounded-xl border border-neutral-800">
          <button
            onClick={() => setVisualMode('bars')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              visualMode === 'bars' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Spectrum Bars
          </button>
          <button
            onClick={() => setVisualMode('circle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              visualMode === 'circle' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Bass Galaxy
          </button>
          <button
            onClick={() => setVisualMode('wave')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              visualMode === 'wave' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Oscilloscope
          </button>
        </div>

        <button
          id="close-visualizer-btn"
          onClick={onClose}
          className="p-2.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all border border-neutral-800"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Floating Timed Comment Bubble */}
      {activeComment && (
        <div className="relative z-10 self-center max-w-md mx-auto animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-neutral-900/90 backdrop-blur-md border border-[#ff5500]/60 p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-white">
            <img
              src={activeComment.userAvatar}
              alt={activeComment.userName}
              className="w-10 h-10 rounded-full border border-[#ff5500] object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-[#ff5500] font-bold">
                <span>{activeComment.userName}</span>
                <span className="text-[10px] text-neutral-400 font-mono">@{formatTime(activeComment.timestamp)}</span>
              </div>
              <p className="text-sm font-medium text-neutral-100 truncate">{activeComment.text}</p>
            </div>
            <MessageSquare className="w-5 h-5 text-[#ff5500] shrink-0" />
          </div>
        </div>
      )}

      {/* Bottom Track Controls HUD */}
      <div className="relative z-10 p-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Track Info */}
        <div className="flex items-center gap-4">
          <img
            src={track.coverArt}
            alt={track.title}
            className="w-16 h-16 rounded-2xl object-cover shadow-2xl border border-neutral-700/60"
          />
          <div>
            <h2 className="text-xl font-black text-white tracking-tight line-clamp-1">{track.title}</h2>
            <p className="text-sm text-[#ff5500] font-medium">{track.artist}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                {track.bpm} BPM
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#ff5500]/20 text-[#ff5500] font-semibold">
                {track.genre}
              </span>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={onPrev}
            className="p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          <button
            id="visualizer-play-btn"
            onClick={onTogglePlay}
            className="w-16 h-16 rounded-full bg-[#ff5500] hover:bg-[#ff6611] text-white flex items-center justify-center transition-transform hover:scale-105 shadow-xl shadow-[#ff5500]/30"
          >
            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </button>

          <button
            onClick={onNext}
            className="p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all"
          >
            <SkipForward className="w-6 h-6" />
          </button>
        </div>

        {/* Time Progress */}
        <div className="text-right font-mono text-sm text-neutral-300">
          <span className="text-[#ff5500] font-bold">{formatTime(currentTime)}</span>
          <span className="text-neutral-500"> / {formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

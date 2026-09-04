import { useState } from 'react';
import { Track, Comment } from '../types';
import { Waveform } from './Waveform';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
  Maximize2,
  Sliders,
  Share2,
  Plus
} from 'lucide-react';

interface GlobalPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'all' | 'one';
  onCycleRepeat: () => void;
  onLikeToggle: (trackId: string) => void;
  onOpenEqualizer: () => void;
  onOpenQueue: () => void;
  onOpenVisualizer: () => void;
  onOpenShare: (track: Track) => void;
  onOpenPlaylist: (track: Track) => void;
  onOpenTrackDetail: (track: Track) => void;
  onOpenArtistProfile: (artistId: string) => void;
  comments?: Comment[];
  queueLength: number;
}

export function GlobalPlayer({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentTime,
  duration,
  onSeek,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onCycleRepeat,
  onLikeToggle,
  onOpenEqualizer,
  onOpenQueue,
  onOpenVisualizer,
  onOpenShare,
  onOpenPlaylist,
  onOpenTrackDetail,
  onOpenArtistProfile,
  comments = [],
  queueLength
}: GlobalPlayerProps) {
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      id="global-audio-player"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#121217]/95 backdrop-blur-xl border-t border-neutral-800/90 shadow-[0_-10px_25px_rgba(0,0,0,0.5)] px-4 py-2.5 transition-all select-none"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Track Details */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
          <div
            onClick={() => onOpenTrackDetail(currentTrack)}
            className="relative group cursor-pointer shrink-0 rounded-lg overflow-hidden"
          >
            <img
              src={currentTrack.coverArt}
              alt={currentTrack.title}
              className="w-12 h-12 rounded-lg object-cover shadow-md group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h4
              onClick={() => onOpenTrackDetail(currentTrack)}
              className="text-xs font-bold text-white truncate cursor-pointer hover:text-[#ff5500] transition-colors"
            >
              {currentTrack.title}
            </h4>
            <p
              onClick={() => onOpenArtistProfile(currentTrack.artistId)}
              className="text-[11px] text-neutral-400 truncate cursor-pointer hover:text-neutral-200 transition-colors"
            >
              {currentTrack.artist}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <button
              id="player-like-btn"
              onClick={() => onLikeToggle(currentTrack.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                currentTrack.isLiked ? 'text-[#ff5500]' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${currentTrack.isLiked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => onOpenPlaylist(currentTrack)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
              title="Add to Playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Controls & Interactive Waveform */}
        <div className="flex flex-col items-center flex-1 max-w-2xl px-2">
          {/* Top Control Buttons */}
          <div className="flex items-center gap-4 mb-1.5">
            {/* Shuffle */}
            <button
              onClick={onToggleShuffle}
              className={`p-1.5 rounded-lg transition-colors ${
                isShuffle ? 'text-[#ff5500]' : 'text-neutral-400 hover:text-white'
              }`}
              title="Shuffle Queue"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Prev */}
            <button
              id="player-prev-btn"
              onClick={onPrev}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Big Play / Pause Button */}
            <button
              id="player-play-btn"
              onClick={onTogglePlay}
              className="w-9 h-9 rounded-full bg-[#ff5500] hover:bg-[#ff6611] text-white flex items-center justify-center shadow-lg shadow-[#ff5500]/25 transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            {/* Next */}
            <button
              id="player-next-btn"
              onClick={onNext}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Repeat */}
            <button
              onClick={onCycleRepeat}
              className={`p-1.5 rounded-lg transition-colors ${
                repeatMode !== 'off' ? 'text-[#ff5500]' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Mini Waveform & Timestamps */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-mono text-neutral-400 w-8 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1">
              <Waveform
                waveformData={currentTrack.waveformData}
                duration={duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={onSeek}
                height={26}
                showComments={false}
              />
            </div>

            <span className="text-[10px] font-mono text-neutral-500 w-8">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Master Tools & Visualizer */}
        <div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[200px]">
          {/* Volume Control */}
          <div
            className="flex items-center gap-2 relative group"
            onMouseEnter={() => setIsVolumeHovered(true)}
            onMouseLeave={() => setIsVolumeHovered(false)}
          >
            <button
              onClick={onToggleMute}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-16 accent-[#ff5500] cursor-pointer h-1 bg-neutral-700 rounded-lg"
            />
          </div>

          {/* Equalizer Button */}
          <button
            id="open-eq-btn"
            onClick={onOpenEqualizer}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Audio Master & Equalizer"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Queue Drawer Button */}
          <button
            id="open-queue-btn"
            onClick={onOpenQueue}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors relative"
            title="Up Next Queue"
          >
            <ListMusic className="w-4 h-4" />
            {queueLength > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#ff5500] text-white text-[9px] font-bold flex items-center justify-center">
                {queueLength}
              </span>
            )}
          </button>

          {/* Fullscreen Visualizer */}
          <button
            id="open-visualizer-btn"
            onClick={onOpenVisualizer}
            className="p-2 rounded-xl bg-neutral-800/80 hover:bg-[#ff5500] text-neutral-300 hover:text-white transition-all shadow-sm"
            title="Launch Fullscreen Spectrum Visualizer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


import type React from 'react';
import { Track } from '../types';
import { Waveform } from './Waveform';
import { Play, Pause, Heart, Repeat, MessageSquare, MoreHorizontal, Plus, Share2 } from 'lucide-react';

interface TrackCardProps {
  key?: React.Key;
  track: Track;
  isCurrentlyPlaying: boolean;
  isPlayingGlobal: boolean;
  currentTime: number;
  onPlay: (track: Track) => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  onLikeToggle: (trackId: string) => void;
  onRepostToggle: (trackId: string) => void;
  onOpenTrackDetail: (track: Track) => void;
  onOpenArtistProfile: (artistId: string) => void;
  onOpenPlaylistModal: (track: Track) => void;
  onOpenShareModal: (track: Track) => void;
  layout?: 'grid' | 'list' | 'stream';
}

export function TrackCard({
  track,
  isCurrentlyPlaying,
  isPlayingGlobal,
  currentTime,
  onPlay,
  onPause,
  onSeek,
  onLikeToggle,
  onRepostToggle,
  onOpenTrackDetail,
  onOpenArtistProfile,
  onOpenPlaylistModal,
  onOpenShareModal,
  layout = 'stream'
}: TrackCardProps) {
  const isPlayingThis = isCurrentlyPlaying && isPlayingGlobal;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (layout === 'grid') {
    return (
      <div className="group bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700/80 rounded-2xl p-4 transition-all duration-200 shadow-sm flex flex-col justify-between">
        {/* Cover Art Image */}
        <div className="relative aspect-square rounded-xl overflow-hidden mb-3.5 bg-neutral-950">
          <img
            src={track.coverArt}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Hover Overlay Play Button */}
          <div
            onClick={() => (isPlayingThis ? onPause() : onPlay(track))}
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity cursor-pointer ${
              isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#ff5500] text-white flex items-center justify-center shadow-xl shadow-[#ff5500]/40 transform group-hover:scale-110 transition-transform">
              {isPlayingThis ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </div>
          </div>

          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[10px] font-mono text-neutral-300">
            {formatTime(track.duration)}
          </span>
        </div>

        {/* Info */}
        <div className="space-y-1">
          <h4
            onClick={() => onOpenTrackDetail(track)}
            className="text-sm font-bold text-white group-hover:text-[#ff5500] transition-colors truncate cursor-pointer"
          >
            {track.title}
          </h4>
          <p
            onClick={() => onOpenArtistProfile(track.artistId)}
            className="text-xs text-neutral-400 hover:text-neutral-200 truncate cursor-pointer font-medium"
          >
            {track.artist}
          </p>
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-neutral-800/60 text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onLikeToggle(track.id)}
              className={`flex items-center gap-1 hover:text-white transition-colors ${
                track.isLiked ? 'text-[#ff5500]' : ''
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${track.isLiked ? 'fill-current' : ''}`} />
              <span className="text-[11px]">{formatNumber(track.likeCount)}</span>
            </button>
            <span className="text-[11px] text-neutral-500">{formatNumber(track.playCount)} plays</span>
          </div>

          <button
            onClick={() => onOpenPlaylistModal(track)}
            className="p-1 rounded hover:bg-neutral-800 hover:text-white transition-colors"
            title="Add to Playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Stream Layout (Classic SoundCloud feed style with full wide waveform)
  return (
    <div
      id={`track-card-${track.id}`}
      className="bg-neutral-900/50 hover:bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-5 transition-all shadow-sm group"
    >
      <div className="flex flex-col md:flex-row gap-5">
        {/* Album Artwork with Play Button */}
        <div className="relative w-36 h-36 shrink-0 rounded-xl overflow-hidden bg-neutral-950 shadow-md">
          <img
            src={track.coverArt}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <div
            onClick={() => (isPlayingThis ? onPause() : onPlay(track))}
            className="absolute inset-0 bg-black/35 flex items-center justify-center cursor-pointer transition-opacity"
          >
            <div className="w-12 h-12 rounded-full bg-[#ff5500] hover:bg-[#ff6611] text-white flex items-center justify-center shadow-xl shadow-[#ff5500]/40 transform hover:scale-110 active:scale-95 transition-all">
              {isPlayingThis ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </div>
          </div>
        </div>

        {/* Content & Waveform */}
        <div className="flex-1 flex flex-col justify-between min-w-0 space-y-3">
          {/* Header Row: Title, Artist, Genre chip, Release time */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <img
                  src={track.artistAvatar}
                  alt={track.artist}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span
                  onClick={() => onOpenArtistProfile(track.artistId)}
                  className="text-xs font-semibold text-neutral-400 hover:text-neutral-200 cursor-pointer"
                >
                  {track.artist}
                </span>
                <span className="text-[11px] text-neutral-600">• {track.releaseDate}</span>
              </div>

              <h3
                onClick={() => onOpenTrackDetail(track)}
                className="text-base font-bold text-white hover:text-[#ff5500] cursor-pointer transition-colors line-clamp-1"
              >
                {track.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ff5500]/15 text-[#ff5500] border border-[#ff5500]/30">
                #{track.genre}
              </span>
              <span className="text-xs font-mono text-neutral-400">
                {formatTime(track.duration)}
              </span>
            </div>
          </div>

          {/* Interactive Waveform Bar */}
          <div className="py-1">
            <Waveform
              waveformData={track.waveformData}
              duration={track.duration}
              currentTime={isCurrentlyPlaying ? currentTime : 0}
              isPlaying={isPlayingThis}
              onSeek={(sec) => {
                if (!isCurrentlyPlaying) {
                  onPlay(track);
                  setTimeout(() => onSeek(sec), 50);
                } else {
                  onSeek(sec);
                }
              }}
              height={46}
              showComments={false}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between pt-1 text-xs text-neutral-400">
            {/* Social Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onLikeToggle(track.id)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all text-xs font-medium ${
                  track.isLiked
                    ? 'bg-[#ff5500]/15 border-[#ff5500] text-[#ff5500]'
                    : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${track.isLiked ? 'fill-current' : ''}`} />
                <span>{formatNumber(track.likeCount)}</span>
              </button>

              <button
                onClick={() => onRepostToggle(track.id)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all text-xs font-medium ${
                  track.isReposted
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                    : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>{formatNumber(track.repostCount)}</span>
              </button>

              <button
                onClick={() => onOpenShareModal(track)}
                className="px-3 py-1.5 rounded-lg bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all text-xs font-medium"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>

              <button
                onClick={() => onOpenPlaylistModal(track)}
                className="p-1.5 rounded-lg bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition-all"
                title="Add to Playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Play & Comment Counts */}
            <div className="flex items-center gap-4 text-neutral-500 text-[11px]">
              <span className="flex items-center gap-1 font-mono">
                <Play className="w-3 h-3 fill-current text-neutral-600" />
                {formatNumber(track.playCount)}
              </span>
              <span
                onClick={() => onOpenTrackDetail(track)}
                className="flex items-center gap-1 hover:text-neutral-300 cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                {formatNumber(track.commentCount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


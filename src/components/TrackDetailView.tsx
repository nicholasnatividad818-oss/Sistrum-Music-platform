import { useState, type FormEvent } from 'react';
import { Track, Comment, Artist } from '../types';
import { Waveform } from './Waveform';
import {
  Play,
  Pause,
  Heart,
  Repeat,
  Share2,
  Plus,
  MessageSquare,
  Sparkles,
  Send,
  UserPlus,
  UserCheck,
  Music,
  Tag,
  Clock,
  ThumbsUp
} from 'lucide-react';

interface TrackDetailViewProps {
  track: Track;
  artist?: Artist;
  comments: Comment[];
  isCurrentlyPlaying: boolean;
  isPlayingGlobal: boolean;
  currentTime: number;
  duration: number;
  onPlay: (track: Track) => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  onLikeToggle: (trackId: string) => void;
  onRepostToggle: (trackId: string) => void;
  onAddComment: (trackId: string, text: string, timestamp: number) => void;
  onFollowArtistToggle: (artistId: string) => void;
  isFollowingArtist: boolean;
  onOpenPlaylistModal: (track: Track) => void;
  onOpenShareModal: (track: Track) => void;
  onOpenArtistProfile: (artistId: string) => void;
  relatedTracks: Track[];
  onSelectTrack: (track: Track) => void;
}

export function TrackDetailView({
  track,
  artist,
  comments,
  isCurrentlyPlaying,
  isPlayingGlobal,
  currentTime,
  duration,
  onPlay,
  onPause,
  onSeek,
  onLikeToggle,
  onRepostToggle,
  onAddComment,
  onFollowArtistToggle,
  isFollowingArtist,
  onOpenPlaylistModal,
  onOpenShareModal,
  onOpenArtistProfile,
  relatedTracks,
  onSelectTrack
}: TrackDetailViewProps) {
  const isPlayingThis = isCurrentlyPlaying && isPlayingGlobal;
  const [commentText, setCommentText] = useState('');
  const [targetCommentTime, setTargetCommentTime] = useState<number | null>(null);

  const activeCommentTimestamp = targetCommentTime !== null ? targetCommentTime : isCurrentlyPlaying ? currentTime : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const handleCommentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(track.id, commentText.trim(), activeCommentTimestamp);
    setCommentText('');
    setTargetCommentTime(null);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in select-none">
      {/* SoundCloud Signature Giant Waveform Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#181820] via-[#20202d] to-[#14141a] border border-neutral-800 shadow-2xl p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row items-stretch justify-between gap-6">
          {/* Left Column: Play button, Titles, Waveform */}
          <div className="flex-1 flex flex-col justify-between min-w-0 space-y-6">
            {/* Top row: Big Play + Title info */}
            <div className="flex items-start gap-4">
              <button
                id="hero-play-button"
                onClick={() => (isPlayingThis ? onPause() : onPlay(track))}
                className="w-16 h-16 rounded-full bg-[#ff5500] hover:bg-[#ff6611] text-white flex items-center justify-center shadow-2xl shadow-[#ff5500]/40 transition-transform hover:scale-105 active:scale-95 shrink-0"
              >
                {isPlayingThis ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    onClick={() => onOpenArtistProfile(track.artistId)}
                    className="text-sm font-semibold text-neutral-300 hover:text-white cursor-pointer bg-neutral-900/60 px-2.5 py-0.5 rounded-full border border-neutral-700/60"
                  >
                    {track.artist}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">• {track.releaseDate}</span>
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight line-clamp-2">
                  {track.title}
                </h1>
              </div>

              {/* Genre badge */}
              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/25">
                  #{track.genre}
                </span>
                <span className="text-xs font-mono text-neutral-400">{track.bpm} BPM</span>
              </div>
            </div>

            {/* Giant Interactive Waveform with Timed Comment Avatars */}
            <div className="pt-4 pb-2">
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
                onWaveformClickTimestamp={(sec) => setTargetCommentTime(sec)}
                comments={comments}
                height={84}
                showComments={true}
              />
            </div>
          </div>

          {/* Right Column: High-Res Album Cover Art */}
          <div className="w-full md:w-64 aspect-square shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-neutral-700/60 relative group">
            <img
              src={track.coverArt}
              alt={track.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-xs font-mono text-white">
              {formatTime(track.duration)}
            </div>
          </div>
        </div>
      </div>

      {/* Timed Comment Composer & Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="md:col-span-2 space-y-6">
          {/* Write a Timed Comment Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"
                alt="Your Avatar"
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-neutral-700"
              />

              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={`Write a comment at ${formatTime(activeCommentTimestamp)}...`}
                  className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-4 pr-24 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-[#ff5500] outline-none"
                />

                <span className="absolute right-3 px-2 py-0.5 rounded bg-neutral-800 text-[11px] font-mono text-[#ff5500] font-bold">
                  {formatTime(activeCommentTimestamp)}
                </span>
              </div>

              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>
          </div>

          {/* Social Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onLikeToggle(track.id)}
                className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${
                  track.isLiked
                    ? 'bg-[#ff5500]/15 border-[#ff5500] text-[#ff5500]'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200'
                }`}
              >
                <Heart className={`w-4 h-4 ${track.isLiked ? 'fill-current' : ''}`} />
                <span>{track.isLiked ? 'Liked' : 'Like'} ({formatNumber(track.likeCount)})</span>
              </button>

              <button
                onClick={() => onRepostToggle(track.id)}
                className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${
                  track.isReposted
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200'
                }`}
              >
                <Repeat className="w-4 h-4" />
                <span>Repost ({formatNumber(track.repostCount)})</span>
              </button>

              <button
                onClick={() => onOpenShareModal(track)}
                className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-2 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>

              <button
                onClick={() => onOpenPlaylistModal(track)}
                className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Playlist</span>
              </button>
            </div>

            {/* Play counter */}
            <div className="flex items-center gap-3 text-xs text-neutral-400 pr-2">
              <span className="font-mono">{formatNumber(track.playCount)} Plays</span>
            </div>
          </div>

          {/* Description & Track Story */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">About this Track</h3>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {track.description || 'No description provided for this track.'}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {track.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Timed Comments Stream */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#ff5500]" />
                <h3 className="text-sm font-bold text-white">
                  Community Comments ({comments.length})
                </h3>
              </div>
              <span className="text-xs text-neutral-500">Click timestamp to seek</span>
            </div>

            {comments.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6 text-center italic">
                Be the first to drop a timed comment on the waveform!
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map((cmt) => (
                  <div
                    key={cmt.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-neutral-950/50 hover:bg-neutral-950 border border-neutral-800/80 transition-colors group"
                  >
                    <img
                      src={cmt.userAvatar}
                      alt={cmt.userName}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-neutral-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-200">{cmt.userName}</span>
                          <button
                            onClick={() => {
                              onSeek(cmt.timestamp);
                              if (!isPlayingGlobal) onPlay(track);
                            }}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#ff5500]/15 text-[#ff5500] hover:bg-[#ff5500] hover:text-white transition-colors font-bold"
                          >
                            at {formatTime(cmt.timestamp)}
                          </button>
                        </div>
                        <span className="text-[10px] text-neutral-500">{cmt.createdAt}</span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">{cmt.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column: Artist Profile Card & Recommendations */}
        <div className="space-y-6">
          {/* Artist Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={artist?.avatar || track.artistAvatar}
                alt={track.artist}
                onClick={() => onOpenArtistProfile(track.artistId)}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#ff5500] cursor-pointer hover:scale-105 transition-transform"
              />
              <div className="min-w-0 flex-1">
                <h4
                  onClick={() => onOpenArtistProfile(track.artistId)}
                  className="text-base font-bold text-white hover:text-[#ff5500] transition-colors cursor-pointer truncate"
                >
                  {track.artist}
                </h4>
                <p className="text-xs text-neutral-400">
                  {formatNumber(artist?.followersCount || 12000)} followers
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
              {artist?.bio || 'Electronic music producer and sound architect.'}
            </p>

            <button
              onClick={() => onFollowArtistToggle(track.artistId)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isFollowingArtist
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  : 'bg-[#ff5500] hover:bg-[#ff6611] text-white shadow-md shadow-[#ff5500]/20'
              }`}
            >
              {isFollowingArtist ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{isFollowingArtist ? 'Following' : 'Follow Artist'}</span>
            </button>
          </div>

          {/* Related Tracks */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Related Tracks
            </h4>
            <div className="space-y-2">
              {relatedTracks.slice(0, 4).map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => onSelectTrack(rel)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-950 cursor-pointer transition-colors group"
                >
                  <img src={rel.coverArt} alt={rel.title} className="w-11 h-11 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-neutral-200 group-hover:text-[#ff5500] transition-colors truncate">
                      {rel.title}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">{rel.artist}</div>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {formatTime(rel.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

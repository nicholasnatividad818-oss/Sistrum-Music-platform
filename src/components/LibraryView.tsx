import { useState } from 'react';
import { Track, Playlist, UserProfile } from '../types';
import { TrackCard } from './TrackCard';
import { Heart, ListMusic, Repeat, Clock, Upload, Plus } from 'lucide-react';

interface LibraryViewProps {
  likedTracks: Track[];
  repostedTracks: Track[];
  uploadedTracks: Track[];
  historyTracks: Track[];
  playlists: Playlist[];
  currentTrackId?: string;
  isPlayingGlobal: boolean;
  currentTime: number;
  onPlayTrack: (track: Track) => void;
  onPauseTrack: () => void;
  onSeek: (seconds: number) => void;
  onLikeToggle: (trackId: string) => void;
  onRepostToggle: (trackId: string) => void;
  onOpenTrackDetail: (track: Track) => void;
  onOpenArtistProfile: (artistId: string) => void;
  onOpenPlaylistModal: (track: Track) => void;
  onOpenShareModal: (track: Track) => void;
  onOpenUploadModal: () => void;
  profile: UserProfile | null;
}

export function LibraryView({
  likedTracks,
  repostedTracks,
  uploadedTracks,
  historyTracks,
  playlists,
  currentTrackId,
  isPlayingGlobal,
  currentTime,
  onPlayTrack,
  onPauseTrack,
  onSeek,
  onLikeToggle,
  onRepostToggle,
  onOpenTrackDetail,
  onOpenArtistProfile,
  onOpenPlaylistModal,
  onOpenShareModal,
  onOpenUploadModal,
  profile
}: LibraryViewProps) {
  const [activeTab, setActiveTab] = useState<'likes' | 'playlists' | 'uploads' | 'reposts' | 'history'>('likes');

  return (
    <div className="space-y-6 pb-24 animate-in fade-in select-none">
      {/* Library Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <img
            src={profile?.avatarUrl || 'https://images.unsplash.com/photo-1520975958225-57c3a5b11c0b?w=200&auto=format&fit=crop&q=80'}
            alt={profile?.displayName || 'Your profile'}
            className="w-16 h-16 rounded-full border-2 border-[#ff5500] object-cover shadow-md"
          />
          <div>
            <h1 className="text-xl font-black text-white">Your Music Library</h1>
            <p className="text-xs text-neutral-400">Manage your liked tracks, custom playlists, and uploaded sounds</p>
          </div>
        </div>

        <button
          onClick={onOpenUploadModal}
          className="px-5 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[#ff5500]/25 self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload / Create</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('likes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'likes' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Liked Tracks ({likedTracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'playlists' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
          <span>Playlists ({playlists.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('uploads')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'uploads' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Your Uploads ({uploadedTracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reposts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'reposts' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Reposts ({repostedTracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'history' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Listening History</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'playlists' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-neutral-700 transition-all group flex flex-col justify-between"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-neutral-950">
                <img src={pl.coverArt} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                  {pl.trackIds.length} tracks
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white group-hover:text-[#ff5500] transition-colors truncate">
                  {pl.title}
                </h3>
                <p className="text-xs text-neutral-400 line-clamp-2">{pl.description}</p>
              </div>

              <div className="pt-3 mt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                <span>By {pl.creator}</span>
                <span>{pl.likesCount} likes</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const list =
              activeTab === 'likes'
                ? likedTracks
                : activeTab === 'uploads'
                ? uploadedTracks
                : activeTab === 'reposts'
                ? repostedTracks
                : historyTracks;

            if (list.length === 0) {
              return (
                <div className="text-center py-16 bg-neutral-900/40 rounded-3xl border border-neutral-800/60 text-neutral-400 space-y-3">
                  <Heart className="w-8 h-8 mx-auto text-neutral-600" />
                  <h3 className="text-sm font-bold text-neutral-300">No tracks found in this category</h3>
                  <p className="text-xs text-neutral-500">Discover new tracks on the stream or upload your own.</p>
                </div>
              );
            }

            return list.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isCurrentlyPlaying={currentTrackId === track.id}
                isPlayingGlobal={isPlayingGlobal}
                currentTime={currentTime}
                onPlay={onPlayTrack}
                onPause={onPauseTrack}
                onSeek={onSeek}
                onLikeToggle={onLikeToggle}
                onRepostToggle={onRepostToggle}
                onOpenTrackDetail={onOpenTrackDetail}
                onOpenArtistProfile={onOpenArtistProfile}
                onOpenPlaylistModal={onOpenPlaylistModal}
                onOpenShareModal={onOpenShareModal}
                layout="stream"
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
}

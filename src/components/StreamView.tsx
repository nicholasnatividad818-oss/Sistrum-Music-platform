import { Track, Artist } from '../types';
import { TrackCard } from './TrackCard';
import { Radio, Sparkles, UserPlus, Upload, Music } from 'lucide-react';

interface StreamViewProps {
  tracks: Track[];
  artists: Artist[];
  followedArtistIds: string[];
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
}

export function StreamView({
  tracks,
  artists,
  followedArtistIds,
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
  onOpenUploadModal
}: StreamViewProps) {
  const streamTracks = tracks.filter(
    (t) => followedArtistIds.includes(t.artistId) || t.isReposted || t.artistId === 'current-user'
  );

  return (
    <div className="space-y-6 pb-24 animate-in fade-in select-none">
      {/* Stream Top Notification */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#ff5500]/20 text-[#ff5500] flex items-center justify-center font-black">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Your Stream Feed</h1>
            <p className="text-xs text-neutral-400">
              Live releases, exclusive drops, and reposts from creators you follow
            </p>
          </div>
        </div>

        <button
          onClick={onOpenUploadModal}
          className="px-5 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-[#ff5500]/25 self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Audio</span>
        </button>
      </div>

      {/* Stream Track List */}
      <div className="space-y-4">
        {streamTracks.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/40 rounded-3xl border border-neutral-800 text-neutral-400 space-y-3">
            <Music className="w-10 h-10 mx-auto text-neutral-600" />
            <h3 className="text-base font-bold text-neutral-300">Your stream is quiet</h3>
            <p className="text-xs text-neutral-500">
              Follow artists on the Discover page to see their latest releases here!
            </p>
          </div>
        ) : (
          streamTracks.map((track) => (
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
          ))
        )}
      </div>
    </div>
  );
}


import { useState } from 'react';
import { Track, Artist, Playlist } from '../types';
import { TrackCard } from './TrackCard';
import { GENRE_LIST } from '../data/mockData';
import {
  Flame,
  Sparkles,
  TrendingUp,
  Award,
  Radio,
  Play,
  Pause,
  Disc,
  Compass,
  ArrowRight,
  Plus
} from 'lucide-react';

interface DiscoverViewProps {
  tracks: Track[];
  artists: Artist[];
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
}

export function DiscoverView({
  tracks,
  artists,
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
  onOpenUploadModal
}: DiscoverViewProps) {
  const [selectedGenre, setSelectedGenre] = useState('All Genres');

  const spotlightTrack = tracks[0] || null;
  const isSpotlightPlaying = spotlightTrack && currentTrackId === spotlightTrack.id && isPlayingGlobal;

  const filteredTracks =
    selectedGenre === 'All Genres'
      ? tracks
      : tracks.filter((t) => t.genre.toLowerCase() === selectedGenre.toLowerCase());

  const trendingTracks = [...tracks].sort((a, b) => b.playCount - a.playCount);

  return (
    <div className="space-y-8 pb-24 animate-in fade-in select-none">
      {/* Hero Spotlight Showcase */}
      {spotlightTrack && (
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-neutral-900 via-[#1e1424] to-neutral-900 border border-neutral-800 shadow-2xl p-6 md:p-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff5500]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/30 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  Featured Spotlight
                </span>
                <span className="text-xs text-neutral-400 font-mono">#{spotlightTrack.genre}</span>
              </div>

              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">
                {spotlightTrack.title}
              </h1>

              <p className="text-xs md:text-sm text-neutral-300 line-clamp-2 leading-relaxed">
                {spotlightTrack.description || 'Analog synths, high-octane basslines, and immersive electronic landscapes.'}
              </p>

              <div className="flex items-center gap-4 pt-2">
                <button
                  id="spotlight-play-btn"
                  onClick={() => (isSpotlightPlaying ? onPauseTrack() : onPlayTrack(spotlightTrack))}
                  className="px-6 py-3 rounded-2xl bg-[#ff5500] hover:bg-[#ff6611] text-white text-xs font-black flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-[#ff5500]/30"
                >
                  {isSpotlightPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isSpotlightPlaying ? 'Pause Track' : 'Play Spotlight'}</span>
                </button>

                <button
                  onClick={() => onOpenTrackDetail(spotlightTrack)}
                  className="px-5 py-3 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold transition-colors"
                >
                  View Details & Comments
                </button>
              </div>
            </div>

            {/* Artwork Card */}
            <div
              onClick={() => onOpenTrackDetail(spotlightTrack)}
              className="relative w-48 md:w-56 aspect-square rounded-2xl overflow-hidden shadow-2xl border border-neutral-700/60 shrink-0 cursor-pointer group"
            >
              <img
                src={spotlightTrack.coverArt}
                alt={spotlightTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Play className="w-8 h-8 text-white fill-current" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Genre Filter Chips */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#ff5500]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Browse by Genre</h3>
          </div>
          <span className="text-xs text-neutral-400">{filteredTracks.length} tracks</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {GENRE_LIST.map((genre) => {
            const isActive = selectedGenre === genre;
            return (
              <button
                key={genre}
                id={`genre-pill-${genre.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-md shadow-[#ff5500]/25'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trending Tracks Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ff5500]" />
            <h3 className="text-base font-black text-white tracking-tight">Trending Right Now</h3>
          </div>
          <span className="text-xs text-neutral-400">Real-time community streams</span>
        </div>

        <div className="space-y-3">
          {filteredTracks.map((track) => (
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
          ))}
        </div>
      </div>

      {/* Featured Artists Row */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#ff5500]" />
            <h3 className="text-base font-black text-white tracking-tight">Spotlight Producers & Creators</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {artists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => onOpenArtistProfile(artist.id)}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 text-center cursor-pointer transition-all hover:-translate-y-1 shadow-sm flex flex-col items-center justify-between"
            >
              <img
                src={artist.avatar}
                alt={artist.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-neutral-700 mb-3"
              />
              <div>
                <h4 className="text-xs font-bold text-white truncate max-w-[140px]">{artist.name}</h4>
                <p className="text-[10px] text-neutral-400 font-mono">@{artist.handle}</p>
                <p className="text-[11px] text-[#ff5500] font-semibold mt-1">{artist.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

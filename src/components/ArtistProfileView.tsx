import { useState } from 'react';
import { Artist, Track } from '../types';
import { TrackCard } from './TrackCard';
import {
  CheckCircle,
  MapPin,
  Users,
  Music,
  Share2,
  Globe,
  Twitter,
  Instagram,
  UserPlus,
  UserCheck,
  Disc
} from 'lucide-react';

interface ArtistProfileViewProps {
  artist: Artist;
  tracks: Track[];
  isFollowing: boolean;
  onFollowToggle: () => void;
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
}

export function ArtistProfileView({
  artist,
  tracks,
  isFollowing,
  onFollowToggle,
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
  onOpenShareModal
}: ArtistProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'tracks' | 'popular' | 'about'>('tracks');

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const sortedPopularTracks = [...tracks].sort((a, b) => b.playCount - a.playCount);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in select-none">
      {/* Banner & Header */}
      <div className="relative rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-xl">
        {/* Banner Image */}
        <div className="h-48 md:h-64 w-full relative">
          <img src={artist.banner} alt={artist.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
        </div>

        {/* Profile Details Bar */}
        <div className="px-6 md:px-8 pb-6 relative -mt-16 md:-mt-20 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            <img
              src={artist.avatar}
              alt={artist.name}
              className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-neutral-900 object-cover shadow-2xl shrink-0"
            />

            <div className="space-y-1.5 pb-2">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl md:text-3xl font-black text-white">{artist.name}</h1>
                {artist.isVerified && (
                  <CheckCircle className="w-5 h-5 text-[#ff5500] fill-current" />
                )}
              </div>

              <p className="text-xs text-neutral-400 font-mono">@{artist.handle}</p>

              <div className="flex items-center justify-center sm:justify-start gap-4 text-xs text-neutral-300 pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  {artist.location}
                </span>
                <span>•</span>
                <span className="font-bold text-white">
                  {formatNumber(artist.followersCount)} <span className="font-normal text-neutral-400">Followers</span>
                </span>
                <span>•</span>
                <span className="font-bold text-white">
                  {tracks.length} <span className="font-normal text-neutral-400">Tracks</span>
                </span>
              </div>
            </div>
          </div>

          {/* Follow & Action Buttons */}
          <div className="flex items-center justify-center sm:justify-end gap-3 pb-2">
            <button
              onClick={onFollowToggle}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
                isFollowing
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                  : 'bg-[#ff5500] hover:bg-[#ff6611] text-white shadow-[#ff5500]/25'
              }`}
            >
              {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{isFollowing ? 'Following' : 'Follow'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
        <button
          onClick={() => setActiveTab('tracks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'tracks' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          All Tracks ({tracks.length})
        </button>
        <button
          onClick={() => setActiveTab('popular')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'popular' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Popular & Top Charts
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'about' ? 'bg-[#ff5500] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          About & Bio
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'about' ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Artist Biography</h3>
          <p className="text-sm text-neutral-300 leading-relaxed">{artist.bio}</p>
          <div className="pt-4 border-t border-neutral-800 flex items-center gap-4 text-xs text-neutral-400">
            {artist.socials?.website && (
              <a
                href={artist.socials.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-white"
              >
                <Globe className="w-4 h-4 text-[#ff5500]" />
                Official Website
              </a>
            )}
            {artist.socials?.twitter && (
              <span className="flex items-center gap-1 hover:text-white">
                <Twitter className="w-4 h-4 text-sky-400" />
                @{artist.socials.twitter}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {(activeTab === 'popular' ? sortedPopularTracks : tracks).map((track) => (
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
      )}
    </div>
  );
}


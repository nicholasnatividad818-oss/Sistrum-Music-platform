export interface Comment {
  id: string;
  trackId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number; // in seconds (for waveform positioning)
  createdAt: string;
  likes: number;
  userBadge?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  artistAvatar: string;
  coverArt: string;
  duration: number; // in seconds
  bpm: number;
  genre: string;
  tags: string[];
  waveformData: number[]; // 60-100 normalized amplitude points (0.1 to 1.0)
  playCount: number;
  likeCount: number;
  repostCount: number;
  commentCount: number;
  releaseDate: string;
  description?: string;
  isLiked?: boolean;
  isReposted?: boolean;
  audioUrl?: string; // If uploaded audio file / blob

  // NRN Catalog integration
  catalogTrackId?: string;
  catalogSource?: 'nrn-catalog';
  isrc?: string;
  catalogSyncedAt?: string;
  synthPreset?: 'lofi' | 'synthwave' | 'house' | 'ambient' | 'trap' | 'futurebass' | 'chillhop';
  stems?: {
    drums?: boolean;
    bass?: boolean;
    melody?: boolean;
    fx?: boolean;
  };
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverArt: string;
  creator: string;
  creatorAvatar: string;
  trackIds: string[];
  isPublic: boolean;
  likesCount: number;
  createdAt: string;
  tags?: string[];
}

export interface Artist {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  bio: string;
  location: string;
  followersCount: number;
  followingCount: number;
  tracksCount: number;
  isVerified: boolean;
  spotlightTrackId?: string;
  socials?: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
}

export interface UserProfile {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string;
  bannerUrl: string;
  bio: string;
  location: string;
  isVerified: boolean;
  termsAcceptedAt: string | null;
}

export type LegalDocument = 'terms' | 'privacy' | 'community' | 'copyright';

export type ActiveTab = 'discover' | 'stream' | 'library' | 'upload' | 'artist' | 'track-detail';

export interface EqualizerSettings {
  low: number;   // -12dB to +12dB
  mid: number;   // -12dB to +12dB
  high: number;  // -12dB to +12dB
  bassBoost: boolean;
  filterCutoff: number; // 200Hz to 20000Hz
  preset: 'flat' | 'bass-boost' | 'electronic' | 'vocal' | 'lofi' | 'club';
}

export interface BeatStep {
  kick: boolean;
  snare: boolean;
  hihat: boolean;
  clap: boolean;
  bass: boolean;
  synth: number | null; // note index or null
}

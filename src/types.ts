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

export type ActiveTab = 'discover' | 'stream' | 'music' | 'library' | 'pios' | 'upload' | 'artist' | 'track-detail';

export type PIOSIntentScope = 'private' | 'direct' | 'circle';
export type PIOSIntentSource = 'text' | 'voice' | 'gesture' | 'semg' | 'eeg';
export type PIOSIntentStatus = 'draft' | 'ready' | 'sent' | 'blocked';

export interface PIOSIntent {
  id: string;
  senderId: string;
  recipientId?: string;
  scope: PIOSIntentScope;
  source: PIOSIntentSource;
  rawInput?: string;
  semanticPayload: string;
  confidence: number;
  status: PIOSIntentStatus;
  requiresExplicitSend: boolean;
  createdAt: string;
  sentAt?: string;
}

export interface PIOSConsentPolicy {
  allowDirectIntents: boolean;
  allowCircleIntents: boolean;
  requireExplicitSend: boolean;
  retainRawInput: boolean;
}

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

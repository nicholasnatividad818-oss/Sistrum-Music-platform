export type FeedFmRadioState =
  | 'unconfigured'
  | 'loading'
  | 'unavailable'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'stalled'
  | 'complete'
  | 'error';

export interface FeedFmStation {
  id: string;
  name: string;
  options?: Record<string, unknown>;
}

export interface FeedFmNowPlaying {
  playId: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  stationName?: string;
}

export interface FeedFmRadioSnapshot {
  state: FeedFmRadioState;
  stations: FeedFmStation[];
  activeStation?: FeedFmStation;
  nowPlaying?: FeedFmNowPlaying;
  canSkip: boolean;
  volume: number;
  message?: string;
}

type Listener = (snapshot: FeedFmRadioSnapshot) => void;

type FeedPlayer = {
  on: (event: string, callback: (...args: any[]) => void) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  skip: () => void;
  like?: () => void;
  dislike?: () => void;
  tune?: (station?: unknown) => void;
  getVolume?: () => number;
  setVolume?: (value: number) => void;
  initializeAudio?: () => void;
  getCurrentState?: () => string;
};

class FeedFmRadioService {
  private player: FeedPlayer | null = null;
  private listeners = new Set<Listener>();
  private snapshot: FeedFmRadioSnapshot = {
    state: 'unconfigured',
    stations: [],
    canSkip: false,
    volume: 85,
    message: 'Add Feed.fm credentials to enable licensed radio.'
  };

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.snapshot;
  }

  private emit(patch: Partial<FeedFmRadioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  async initialize() {
    if (this.player) return;

    const token = import.meta.env.VITE_FEEDFM_TOKEN as string | undefined;
    const secret = import.meta.env.VITE_FEEDFM_SECRET as string | undefined;

    if (!token || !secret) {
      this.emit({
        state: 'unconfigured',
        message: 'Feed.fm Radio is wired in, but production/development credentials are not configured.'
      });
      return;
    }

    this.emit({ state: 'loading', message: 'Connecting to Feed.fm…' });

    try {
      const mod: any = await import('feed-media-audio-player');
      const Feed = mod.default ?? mod;
      this.player = new Feed.Player(token, secret);
      this.bindEvents();
    } catch (error) {
      this.emit({
        state: 'error',
        message: error instanceof Error ? error.message : 'Could not initialize Feed.fm.'
      });
    }
  }

  private bindEvents() {
    const player = this.player;
    if (!player) return;

    player.on('stations', (stations: any[]) => {
      const mapped = (stations ?? []).map((station) => ({
        id: String(station.id),
        name: station.name,
        options: station.options ?? {}
      }));
      this.emit({
        state: 'ready',
        stations: mapped,
        activeStation: mapped[0],
        message: mapped.length ? undefined : 'No stations are currently available.'
      });
      if (mapped.length && player.tune) player.tune(stations[0]);
    });

    player.on('not-in-us', () => {
      this.emit({
        state: 'unavailable',
        message: 'Feed.fm music is not available for this listener or territory.'
      });
    });

    player.on('play-started', (play: any) => {
      this.emit({
        state: 'playing',
        canSkip: true,
        nowPlaying: {
          playId: String(play?.id ?? ''),
          title: play?.audio_file?.track?.title ?? 'Unknown track',
          artist: play?.audio_file?.artist?.name ?? 'Unknown artist',
          album: play?.audio_file?.release?.title,
          duration: play?.audio_file?.duration_in_seconds,
          stationName: play?.station?.name
        }
      });
    });

    player.on('play-paused', () => this.emit({ state: 'paused' }));
    player.on('play-resumed', () => this.emit({ state: 'playing' }));
    player.on('play-stopped', () => this.emit({ state: 'ready', nowPlaying: undefined }));
    player.on('plays-exhausted', () => this.emit({ state: 'complete', canSkip: false }));
    player.on('skip-denied', () =>
      this.emit({ canSkip: false, message: 'Skip unavailable due to station/licensing limits.' })
    );
    player.on('stalled', () => this.emit({ state: 'stalled', message: 'Buffering licensed audio…' }));
  }

  initializeAudio() {
    this.player?.initializeAudio?.();
  }

  play() {
    if (!this.player) return;
    this.player.initializeAudio?.();
    this.player.play();
  }

  pause() {
    this.player?.pause();
  }

  stop() {
    this.player?.stop();
  }

  skip() {
    if (this.snapshot.canSkip) this.player?.skip();
  }

  like() {
    this.player?.like?.();
  }

  dislike() {
    this.player?.dislike?.();
  }

  setVolume(volume: number) {
    const normalized = Math.max(0, Math.min(100, Math.round(volume)));
    this.player?.setVolume?.(normalized);
    this.emit({ volume: normalized });
  }
}

export const feedFmRadio = new FeedFmRadioService();

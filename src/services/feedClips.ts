export interface FeedClip {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  explicitness?: 'clean' | 'explicit' | 'censored' | 'unknown';
  duration?: number;
  url?: string;
  artworkUrl?: string;
}

export interface FeedClipCollection {
  id: string;
  name: string;
  rating?: string;
  explicit?: boolean;
}

type ClipEvent = 'preview' | 'play' | 'add' | 'share' | 'download';

class FeedClipsService {
  private readonly baseUrl = 'https://clips.feed.fm';

  private get token() {
    return import.meta.env.VITE_FEED_CLIPS_TOKEN as string | undefined;
  }

  private get clientId() {
    const key = 'nrn_feed_client_id';
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(key, value);
    }
    return value;
  }

  isConfigured() {
    return Boolean(this.token);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.token) throw new Error('Feed Clips token is not configured.');

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Feed Clips ${response.status}: ${body || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async appStart() {
    if (!this.isConfigured()) return;
    await this.request('/v2/app/start', {
      method: 'POST',
      body: JSON.stringify({ clientId: this.clientId })
    });
  }

  async appClose() {
    if (!this.isConfigured()) return;
    await this.request('/v2/app/close', {
      method: 'POST',
      body: JSON.stringify({ clientId: this.clientId })
    });
  }

  async getCollections(): Promise<FeedClipCollection[]> {
    const payload: any = await this.request(`/v2/collections?clientId=${encodeURIComponent(this.clientId)}`);
    const collections = payload?.collections ?? payload?.data ?? payload ?? [];
    return collections.map((item: any) => ({
      id: String(item.id),
      name: item.name ?? item.title ?? 'Untitled collection',
      rating: item.rating,
      explicit: Boolean(item.explicit)
    }));
  }

  async getClips(collectionId?: string): Promise<FeedClip[]> {
    const params = new URLSearchParams({ clientId: this.clientId });
    if (collectionId) params.set('collectionId', collectionId);
    const payload: any = await this.request(`/v2/clips?${params.toString()}`);
    const clips = payload?.clips ?? payload?.data ?? payload ?? [];
    return clips.map((item: any) => this.normalizeClip(item));
  }

  async getTrackClips(trackId: string): Promise<FeedClip[]> {
    const payload: any = await this.request(
      `/v2/tracks/${encodeURIComponent(trackId)}/clips?clientId=${encodeURIComponent(this.clientId)}`
    );
    const clips = payload?.clips ?? payload?.data ?? payload ?? [];
    return clips.map((item: any) => this.normalizeClip(item));
  }

  async report(clipId: string, event: ClipEvent, extra: Record<string, unknown> = {}) {
    if (!this.isConfigured()) return;
    await this.request(`/v2/clips/${encodeURIComponent(clipId)}/${event}`, {
      method: 'POST',
      body: JSON.stringify({ clientId: this.clientId, ...extra })
    });
  }

  private normalizeClip(item: any): FeedClip {
    return {
      id: String(item.id),
      title: item.track?.title ?? item.title,
      artist: item.track?.artist?.name ?? item.artist?.name ?? item.artist,
      album: item.track?.release?.title ?? item.album,
      explicitness: item.explicitness,
      duration: item.duration ?? item.durationSeconds ?? item.duration_in_seconds,
      url: item.url ?? item.signedUrl ?? item.signed_url,
      artworkUrl: item.artworkUrl ?? item.artwork_url
    };
  }
}

export const feedClips = new FeedClipsService();

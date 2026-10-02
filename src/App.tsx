/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Track, Artist, Playlist, Comment, ActiveTab, EqualizerSettings } from './types';
import { MOCK_ARTISTS, MOCK_PLAYLISTS, MOCK_COMMENTS, CURRENT_USER } from './data/mockData';
import { audioEngine } from './services/audioEngine';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { signOut } from './services/auth';
import { listTracks, recordPlay } from './services/tracks';
import { fetchBillingStatus, startProCheckout, type BillingStatus } from './services/billing';
import { Navbar } from './components/Navbar';
import { DiscoverView } from './components/DiscoverView';
import { StreamView } from './components/StreamView';
import { LibraryView } from './components/LibraryView';
import { TrackDetailView } from './components/TrackDetailView';
import { ArtistProfileView } from './components/ArtistProfileView';
import { GlobalPlayer } from './components/GlobalPlayer';
import { EqualizerModal } from './components/EqualizerModal';
import { VisualizerModal } from './components/VisualizerModal';
import { UploadModal } from './components/UploadModal';
import { QueueDrawer } from './components/QueueDrawer';
import { ShareModal } from './components/ShareModal';
import { PlaylistModal } from './components/PlaylistModal';
import { SistrumAssistant } from './components/SistrumAssistant';
import { AuthModal } from './components/AuthModal';

function accountName(user: User | null): string {
  if (!user) return CURRENT_USER.name;
  const meta = user.user_metadata?.display_name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  return user.email?.split('@')[0] || 'Artist';
}

export default function App() {
  // --- Data State ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [tracksLoading, setTracksLoading] = useState(isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingNote, setBillingNote] = useState<string | null>(null);

  const [artists, setArtists] = useState<Artist[]>(MOCK_ARTISTS);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('soundwave_playlists');
    return saved ? JSON.parse(saved) : MOCK_PLAYLISTS;
  });

  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>(() => {
    const saved = localStorage.getItem('soundwave_comments');
    return saved ? JSON.parse(saved) : MOCK_COMMENTS;
  });

  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>(CURRENT_USER.followingArtistIds);

  // --- Active Tab Navigation & Views ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- Player State ---
  const [currentTrack, setCurrentTrack] = useState<Track | null>(tracks[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(tracks[0]?.duration || 180);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>(tracks.slice(1));
  const [history, setHistory] = useState<Track[]>([]);

  // --- Equalizer Settings ---
  const [equalizerSettings, setEqualizerSettings] = useState<EqualizerSettings>({
    low: 0,
    mid: 0,
    high: 0,
    bassBoost: false,
    filterCutoff: 20000,
    preset: 'flat'
  });

  // --- Modals State ---
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [shareModalTrack, setShareModalTrack] = useState<Track | null>(null);
  const [playlistModalTrack, setPlaylistModalTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setTracksError('Add a real VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then run the SQL files in supabase/.');
      return;
    }
    let cancel = false;
    setTracksLoading(true);
    listTracks()
      .then((rows) => {
        if (cancel) return;
        setTracks(rows);
        setTracksError(null);
        setCurrentTrack((current) => (current && rows.some((track) => track.id === current.id) ? current : rows[0] || null));
        setQueue((current) => (current.length > 0 ? current : rows.slice(1)));
      })
      .catch((err: unknown) => {
        if (cancel) return;
        const message = err instanceof Error ? err.message : 'Could not load tracks';
        setTracksError(
          /failed to fetch|network|load failed|enotfound|timeout|could not reach/i.test(message)
            ? 'Could not reach Supabase. Use the project URL from the Supabase dashboard, then run the SQL files in supabase/.'
            : message,
        );
      })
      .finally(() => {
        if (!cancel) setTracksLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser) {
      setBilling(null);
      return;
    }
    fetchBillingStatus()
      .then(setBilling)
      .catch((err: unknown) => {
        setBilling(null);
        setBillingNote(err instanceof Error ? err.message : null);
      });
  }, [authUser?.id]);

  useEffect(() => {
    localStorage.setItem('soundwave_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('soundwave_comments', JSON.stringify(commentsMap));
  }, [commentsMap]);

  // Audio Engine Callbacks Setup
  const handleTrackEnded = useCallback(() => {
    if (repeatMode === 'one') {
      audioEngine.seek(0);
      audioEngine.play();
    } else {
      handleNextTrack();
    }
  }, [repeatMode, queue]);

  useEffect(() => {
    audioEngine.setCallbacks(
      (curTime, dur) => {
        setCurrentTime(curTime);
        setDuration(dur);
      },
      () => handleTrackEnded()
    );
  }, [handleTrackEnded]);

  // Play a specific track
  const handlePlayTrack = async (track: Track) => {
    setCurrentTrack(track);
    setDuration(track.duration);
    setCurrentTime(0);

    // Track play count increment
    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, playCount: t.playCount + 1 } : t))
    );
    void recordPlay(track.id);

    // Update history
    setHistory((prev) => [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 20));

    await audioEngine.loadTrack(
      track.synthPreset || 'synthwave',
      track.duration,
      track.bpm,
      track.audioUrl
    );
    audioEngine.play();
    setIsPlaying(true);
  };

  const handlePauseTrack = () => {
    audioEngine.pause();
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (!currentTrack) {
      if (tracks[0]) handlePlayTrack(tracks[0]);
      return;
    }
    if (isPlaying) {
      handlePauseTrack();
    } else {
      audioEngine.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  const handleNextTrack = () => {
    if (queue.length > 0) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      handlePlayTrack(next);
    } else if (repeatMode === 'all' && tracks.length > 0) {
      handlePlayTrack(tracks[0]);
    } else {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrack?.id);
      const nextIndex = (currentIndex + 1) % tracks.length;
      handlePlayTrack(tracks[nextIndex]);
    }
  };

  const handlePrevTrack = () => {
    if (currentTime > 3) {
      handleSeek(0);
      return;
    }
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    handlePlayTrack(tracks[prevIndex]);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    setIsMuted(false);
    audioEngine.setVolume(vol);
  };

  const handleToggleMute = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleCycleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  const handleToggleShuffle = () => {
    setIsShuffle((prev) => !prev);
    if (!isShuffle) {
      setQueue((prev) => [...prev].sort(() => Math.random() - 0.5));
    }
  };

  const handleUpdateEqualizer = (newSettings: EqualizerSettings) => {
    setEqualizerSettings(newSettings);
    audioEngine.applyEqualizer(newSettings);
  };

  // Like Track toggle
  const handleLikeToggle = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const isLiked = !t.isLiked;
          return {
            ...t,
            isLiked,
            likeCount: isLiked ? t.likeCount + 1 : Math.max(0, t.likeCount - 1)
          };
        }
        return t;
      })
    );
  };

  // Repost Track toggle
  const handleRepostToggle = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const isReposted = !t.isReposted;
          return {
            ...t,
            isReposted,
            repostCount: isReposted ? t.repostCount + 1 : Math.max(0, t.repostCount - 1)
          };
        }
        return t;
      })
    );
  };

  // Follow artist toggle
  const handleFollowToggle = (artistId: string) => {
    setFollowedArtistIds((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    );
    setArtists((prev) =>
      prev.map((a) => {
        if (a.id === artistId) {
          const isFollowing = followedArtistIds.includes(artistId);
          return {
            ...a,
            followersCount: isFollowing ? a.followersCount - 1 : a.followersCount + 1
          };
        }
        return a;
      })
    );
  };

  // Add a timed comment to a track
  const handleAddComment = (trackId: string, text: string, timestamp: number) => {
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      trackId,
      userId: authUser?.id || CURRENT_USER.id,
      userName: accountName(authUser),
      userAvatar: CURRENT_USER.avatar,
      text,
      timestamp,
      createdAt: 'Just now',
      likes: 0
    };

    setCommentsMap((prev) => ({
      ...prev,
      [trackId]: [...(prev[trackId] || []), newComment]
    }));

    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, commentCount: t.commentCount + 1 } : t))
    );
  };

  // Add newly uploaded/composed track
  const handleTrackCreated = (newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev]);
    setSelectedTrack(newTrack);
    setActiveTab('track-detail');
    handlePlayTrack(newTrack);
  };

  // Create new playlist
  const handleCreatePlaylist = (title: string, description: string) => {
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      title,
      description,
      coverArt: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      creator: accountName(authUser),
      creatorAvatar: CURRENT_USER.avatar,
      trackIds: playlistModalTrack ? [playlistModalTrack.id] : [],
      isPublic: true,
      likesCount: 1,
      createdAt: 'Just now'
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
  };

  // Toggle track inside a playlist
  const handleToggleTrackInPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          const exists = pl.trackIds.includes(trackId);
          return {
            ...pl,
            trackIds: exists ? pl.trackIds.filter((id) => id !== trackId) : [...pl.trackIds, trackId]
          };
        }
        return pl;
      })
    );
  };

  // Open Views
  const handleOpenTrackDetail = (track: Track) => {
    setSelectedTrack(track);
    setActiveTab('track-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenArtistProfile = (artistId: string) => {
    setSelectedArtistId(artistId);
    setActiveTab('artist');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Search Filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { tracks: [], artists: [] };
    const q = searchQuery.toLowerCase();
    return {
      tracks: tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      ),
      artists: artists.filter(
        (a) => a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q)
      )
    };
  }, [tracks, artists, searchQuery]);

  // Selected Artist for profile view
  const openAuth = () => setAuthOpen(true);
  const openUpload = () => {
    if (!authUser) {
      setAuthOpen(true);
      return;
    }
    setIsUploadOpen(true);
  };
  const handleUpgrade = async () => {
    if (!authUser) {
      setAuthOpen(true);
      return;
    }
    try {
      const url = await startProCheckout();
      window.location.assign(url);
    } catch (err) {
      setBillingNote(err instanceof Error ? err.message : 'Could not start checkout');
    }
  };

  const activeArtist =
    artists.find((a) => a.id === selectedArtistId) ||
    (selectedArtistId
      ? {
          id: selectedArtistId,
          name: tracks.find((track) => track.artistId === selectedArtistId)?.artist || 'Artist',
          handle: 'artist',
          avatar: tracks.find((track) => track.artistId === selectedArtistId)?.artistAvatar || CURRENT_USER.avatar,
          banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
          bio: 'Sistrum artist',
          location: '',
          followersCount: 0,
          followingCount: 0,
          tracksCount: tracks.filter((track) => track.artistId === selectedArtistId).length,
          isVerified: billing?.plan === 'pro' && selectedArtistId === authUser?.id,
        }
      : artists[0]);
  const activeArtistTracks = tracks.filter((t) => t.artistId === activeArtist?.id);

  // Active track comments
  const activeTrackComments = selectedTrack
    ? commentsMap[selectedTrack.id] || []
    : currentTrack
    ? commentsMap[currentTrack.id] || []
    : [];

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-neutral-100 flex flex-col font-sans selection:bg-[#ff5500] selection:text-white">
      {/* Persistent Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenUpload={openUpload}
        onOpenArtistProfile={handleOpenArtistProfile}
        onOpenTrackDetail={handleOpenTrackDetail}
        searchResults={searchResults}
        isPlaying={isPlaying}
        user={authUser ? { name: accountName(authUser), email: authUser.email || '' } : null}
        plan={billing?.plan || (authUser ? 'free' : null)}
        onSignIn={openAuth}
        onSignOut={() => {
          void signOut();
        }}
        onUpgrade={() => {
          void handleUpgrade();
        }}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-6">
        {(tracksLoading || tracksError || billingNote || !isSupabaseConfigured) && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            {tracksLoading && !tracksError
              ? 'Loading catalog…'
              : tracksError || billingNote || 'Add a real VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then run the SQL files in supabase/.'}
          </div>
        )}
        {activeTab === 'discover' && (
          <DiscoverView
            tracks={tracks}
            artists={artists}
            playlists={playlists}
            currentTrackId={currentTrack?.id}
            isPlayingGlobal={isPlaying}
            currentTime={currentTime}
            onPlayTrack={handlePlayTrack}
            onPauseTrack={handlePauseTrack}
            onSeek={handleSeek}
            onLikeToggle={handleLikeToggle}
            onRepostToggle={handleRepostToggle}
            onOpenTrackDetail={handleOpenTrackDetail}
            onOpenArtistProfile={handleOpenArtistProfile}
            onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
            onOpenShareModal={(t) => setShareModalTrack(t)}
            onOpenUploadModal={openUpload}
          />
        )}

        {activeTab === 'stream' && (
          <StreamView
            tracks={tracks}
            artists={artists}
            followedArtistIds={followedArtistIds}
            currentTrackId={currentTrack?.id}
            isPlayingGlobal={isPlaying}
            currentTime={currentTime}
            onPlayTrack={handlePlayTrack}
            onPauseTrack={handlePauseTrack}
            onSeek={handleSeek}
            onLikeToggle={handleLikeToggle}
            onRepostToggle={handleRepostToggle}
            onOpenTrackDetail={handleOpenTrackDetail}
            onOpenArtistProfile={handleOpenArtistProfile}
            onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
            onOpenShareModal={(t) => setShareModalTrack(t)}
            onOpenUploadModal={openUpload}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            likedTracks={tracks.filter((t) => t.isLiked)}
            repostedTracks={tracks.filter((t) => t.isReposted)}
            uploadedTracks={tracks.filter((t) => authUser && t.artistId === authUser.id)}
            historyTracks={history}
            playlists={playlists}
            currentTrackId={currentTrack?.id}
            isPlayingGlobal={isPlaying}
            currentTime={currentTime}
            onPlayTrack={handlePlayTrack}
            onPauseTrack={handlePauseTrack}
            onSeek={handleSeek}
            onLikeToggle={handleLikeToggle}
            onRepostToggle={handleRepostToggle}
            onOpenTrackDetail={handleOpenTrackDetail}
            onOpenArtistProfile={handleOpenArtistProfile}
            onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
            onOpenShareModal={(t) => setShareModalTrack(t)}
            onOpenUploadModal={openUpload}
          />
        )}

        {activeTab === 'track-detail' && selectedTrack && (
          <TrackDetailView
            track={selectedTrack}
            artist={artists.find((a) => a.id === selectedTrack.artistId)}
            comments={commentsMap[selectedTrack.id] || []}
            isCurrentlyPlaying={currentTrack?.id === selectedTrack.id}
            isPlayingGlobal={isPlaying}
            currentTime={currentTime}
            duration={selectedTrack.duration}
            onPlay={handlePlayTrack}
            onPause={handlePauseTrack}
            onSeek={handleSeek}
            onLikeToggle={handleLikeToggle}
            onRepostToggle={handleRepostToggle}
            onAddComment={handleAddComment}
            onFollowArtistToggle={handleFollowToggle}
            isFollowingArtist={followedArtistIds.includes(selectedTrack.artistId)}
            onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
            onOpenShareModal={(t) => setShareModalTrack(t)}
            onOpenArtistProfile={handleOpenArtistProfile}
            relatedTracks={tracks.filter((t) => t.id !== selectedTrack.id && t.genre === selectedTrack.genre)}
            onSelectTrack={handleOpenTrackDetail}
          />
        )}

        {activeTab === 'artist' && activeArtist && (
          <ArtistProfileView
            artist={activeArtist}
            tracks={activeArtistTracks}
            isFollowing={followedArtistIds.includes(activeArtist.id)}
            onFollowToggle={() => handleFollowToggle(activeArtist.id)}
            currentTrackId={currentTrack?.id}
            isPlayingGlobal={isPlaying}
            currentTime={currentTime}
            onPlayTrack={handlePlayTrack}
            onPauseTrack={handlePauseTrack}
            onSeek={handleSeek}
            onLikeToggle={handleLikeToggle}
            onRepostToggle={handleRepostToggle}
            onOpenTrackDetail={handleOpenTrackDetail}
            onOpenArtistProfile={handleOpenArtistProfile}
            onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
            onOpenShareModal={(t) => setShareModalTrack(t)}
          />
        )}
      </main>

      {/* Docked Global Bottom Player Bar */}
      <GlobalPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        isShuffle={isShuffle}
        onToggleShuffle={handleToggleShuffle}
        repeatMode={repeatMode}
        onCycleRepeat={handleCycleRepeat}
        onLikeToggle={handleLikeToggle}
        onOpenEqualizer={() => setIsEqualizerOpen(true)}
        onOpenQueue={() => setIsQueueOpen(true)}
        onOpenVisualizer={() => setIsVisualizerOpen(true)}
        onOpenShare={(t) => setShareModalTrack(t)}
        onOpenPlaylist={(t) => setPlaylistModalTrack(t)}
        onOpenTrackDetail={handleOpenTrackDetail}
        onOpenArtistProfile={handleOpenArtistProfile}
        comments={activeTrackComments}
        queueLength={queue.length}
      />

      {/* Modals & Drawers */}
      <EqualizerModal
        isOpen={isEqualizerOpen}
        onClose={() => setIsEqualizerOpen(false)}
        settings={equalizerSettings}
        onUpdateSettings={handleUpdateEqualizer}
      />

      {currentTrack && (
        <VisualizerModal
          isOpen={isVisualizerOpen}
          onClose={() => setIsVisualizerOpen(false)}
          track={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onNext={handleNextTrack}
          onPrev={handlePrevTrack}
          currentTime={currentTime}
          duration={duration}
          comments={activeTrackComments}
        />
      )}

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onTrackCreated={handleTrackCreated}
        user={authUser ? { id: authUser.id, name: accountName(authUser) } : null}
        onRequireAuth={openAuth}
      />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        currentTrack={currentTrack}
        queue={queue}
        onPlayTrack={handlePlayTrack}
        onRemoveFromQueue={(id) => setQueue((prev) => prev.filter((t) => t.id !== id))}
        onClearQueue={() => setQueue([])}
        onShuffleQueue={handleToggleShuffle}
      />

      {shareModalTrack && (
        <ShareModal
          isOpen={!!shareModalTrack}
          onClose={() => setShareModalTrack(null)}
          track={shareModalTrack}
        />
      )}

      {playlistModalTrack && (
        <PlaylistModal
          isOpen={!!playlistModalTrack}
          onClose={() => setPlaylistModalTrack(null)}
          track={playlistModalTrack}
          playlists={playlists}
          onCreatePlaylist={handleCreatePlaylist}
          onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
        />
      )}

      <SistrumAssistant onUpgrade={() => { void handleUpgrade(); }} />
    </div>
  );
}

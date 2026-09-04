/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Analytics } from '@vercel/analytics/react';
import { Track, Artist, Playlist, Comment, ActiveTab, EqualizerSettings, LegalDocument, UserProfile } from './types';
import { audioEngine } from './services/audioEngine';
import { supabase } from './lib/supabase';
import { signOut } from './services/auth';
import {
  createComment,
  createPlaylist,
  deleteCurrentAccount,
  loadPlatformData,
  reportTrack,
  setArtistFollow,
  setPlaylistTrack,
  setTrackLike,
  setTrackRepost,
} from './services/platform';
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
import { AuthModal } from './components/AuthModal';
import { LegalModal } from './components/LegalModal';
import { ReportModal } from './components/ReportModal';
import { AppFooter } from './components/AppFooter';

export default function App() {
  // --- Data State ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');

  // --- Active Tab Navigation & Views ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- Player State ---
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>([]);
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
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [reportModalTrack, setReportModalTrack] = useState<Track | null>(null);
  const [accountDeletePending, setAccountDeletePending] = useState(false);

  const refreshData = useCallback(async (activeUser: User | null = user) => {
    setDataError('');
    try {
      const data = await loadPlatformData(activeUser);
      setTracks(data.tracks);
      setArtists(data.artists);
      setPlaylists(data.playlists);
      setCommentsMap(data.comments);
      setFollowedArtistIds(data.followedArtistIds);
      setProfile(data.profile);
      setCurrentTrack((current) => current ? data.tracks.find((track) => track.id === current.id) || data.tracks[0] || null : data.tracks[0] || null);
      setSelectedTrack((selected) => selected ? data.tracks.find((track) => track.id === selected.id) || null : null);
      setQueue(data.tracks.slice(1));
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to load Sistrum data.');
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setDataError(error.message);
      const activeUser = data.session?.user || null;
      setUser(activeUser);
      void refreshData(activeUser);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user || null;
      setUser(activeUser);
      void refreshData(activeUser);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

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

    // Update history
    setHistory((prev) => [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 20));

    try {
      await audioEngine.loadTrack(
        track.synthPreset || 'synthwave',
        track.duration,
        track.bpm,
        track.audioUrl
      );
      audioEngine.play();
      setIsPlaying(true);
    } catch {
      setDataError('This track could not be played. The file may be unavailable or unsupported.');
      setIsPlaying(false);
    }
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
    if (tracks.length === 0) return;
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
    if (tracks.length === 0) return;
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

  const requireUser = () => {
    if (user) return user;
    setIsAuthOpen(true);
    return null;
  };

  const handleLikeToggle = async (trackId: string) => {
    const activeUser = requireUser();
    if (!activeUser) return;
    const track = tracks.find((item) => item.id === trackId);
    if (!track) return;
    try {
      await setTrackLike(activeUser.id, trackId, !track.isLiked);
      await refreshData(activeUser);
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to update this like.');
    }
  };

  const handleRepostToggle = async (trackId: string) => {
    const activeUser = requireUser();
    if (!activeUser) return;
    const track = tracks.find((item) => item.id === trackId);
    if (!track) return;
    try {
      await setTrackRepost(activeUser.id, trackId, !track.isReposted);
      await refreshData(activeUser);
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to update this repost.');
    }
  };

  const handleFollowToggle = async (artistId: string) => {
    const activeUser = requireUser();
    if (!activeUser || activeUser.id === artistId) return;
    try {
      await setArtistFollow(activeUser.id, artistId, !followedArtistIds.includes(artistId));
      await refreshData(activeUser);
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to update this follow.');
    }
  };

  const handleAddComment = async (trackId: string, text: string, timestamp: number) => {
    const activeUser = requireUser();
    if (!activeUser) return;
    try {
      await createComment(activeUser.id, trackId, text, timestamp);
      await refreshData(activeUser);
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to post this comment.');
    }
  };

  const handleTrackCreated = async () => {
    await refreshData(user);
    setActiveTab('library');
  };

  const handleCreatePlaylist = async (title: string, description: string) => {
    const activeUser = requireUser();
    if (!activeUser) return;
    try {
      await createPlaylist(activeUser.id, title, description, playlistModalTrack?.id);
      await refreshData(activeUser);
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to create this playlist.');
    }
  };

  const handleToggleTrackInPlaylist = async (playlistId: string, trackId: string) => {
    const activeUser = requireUser();
    if (!activeUser) return;
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return;
    try {
      const active = !playlist.trackIds.includes(trackId);
      await setPlaylistTrack(playlistId, trackId, active, playlist.trackIds.length);
      await refreshData(activeUser);
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to update this playlist.');
    }
  };

  const handleOpenUpload = () => {
    if (!requireUser()) return;
    setIsUploadOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
    setActiveTab('discover');
  };

  const handleDeleteAccount = async () => {
    if (!user || accountDeletePending) return;
    const confirmed = window.confirm('Permanently delete your Sistrum account, uploads, playlists, comments, and social activity? This cannot be undone.');
    if (!confirmed) return;
    setAccountDeletePending(true);
    try {
      await deleteCurrentAccount();
      await signOut();
      setActiveTab('discover');
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Unable to delete this account.');
    } finally {
      setAccountDeletePending(false);
    }
  };

  const handleReportTrack = async (
    reason: 'copyright' | 'harassment' | 'spam' | 'other',
    details: string
  ) => {
    const activeUser = requireUser();
    if (!activeUser || !reportModalTrack) throw new Error('Sign in to submit a report.');
    await reportTrack(activeUser.id, reportModalTrack.id, reason, details);
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
  const activeArtist = artists.find((a) => a.id === selectedArtistId) || artists[0];
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
          if (tab === 'library' && !user) {
            setIsAuthOpen(true);
            return;
          }
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenUpload={handleOpenUpload}
        onOpenArtistProfile={handleOpenArtistProfile}
        onOpenTrackDetail={handleOpenTrackDetail}
        searchResults={searchResults}
        isPlaying={isPlaying}
        user={user}
        profile={profile}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        onDeleteAccount={() => void handleDeleteAccount()}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ff5500]/30 bg-[#ff5500]/10 px-4 py-3 text-xs">
          <span className="font-bold text-orange-100">Sistrum is in private beta. Keep your own backup of every master.</span>
          {!user && <button onClick={() => setIsAuthOpen(true)} className="font-black text-[#ff7a3d] hover:text-white">Join the beta</button>}
        </div>

        {dataError && (
          <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-rose-900/60 bg-rose-950/35 px-4 py-3 text-xs text-rose-200">
            <span>{dataError}</span>
            <button onClick={() => void refreshData(user)} className="font-black text-white">Retry</button>
          </div>
        )}

        {isLoadingData && (
          <div className="py-24 text-center text-sm font-bold text-neutral-400">Loading the Sistrum catalog…</div>
        )}

        {!isLoadingData && tracks.length === 0 && activeTab === 'discover' && (
          <section className="mb-8 rounded-3xl border border-neutral-800 bg-neutral-900 p-10 text-center">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-[#ff5500]">A clean first page</div>
            <h1 className="mt-3 text-3xl font-black text-white">The Sistrum beta is ready for its first original release.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-400">No fabricated artists, streams, or comments—only music that beta creators actually publish.</p>
            <button onClick={handleOpenUpload} className="mt-6 rounded-xl bg-[#ff5500] px-6 py-3 text-sm font-black text-white">Publish the first track</button>
          </section>
        )}

        {!isLoadingData && activeTab === 'discover' && tracks.length > 0 && (
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
            onOpenUploadModal={handleOpenUpload}
          />
        )}

        {!isLoadingData && activeTab === 'stream' && (
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
            onOpenUploadModal={handleOpenUpload}
          />
        )}

        {!isLoadingData && activeTab === 'library' && user && (
          <LibraryView
            likedTracks={tracks.filter((t) => t.isLiked)}
            repostedTracks={tracks.filter((t) => t.isReposted)}
            uploadedTracks={tracks.filter((t) => t.artistId === user.id)}
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
            onOpenUploadModal={handleOpenUpload}
            profile={profile}
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
            onReportTrack={(track) => {
              if (requireUser()) setReportModalTrack(track);
            }}
            onOpenArtistProfile={handleOpenArtistProfile}
            relatedTracks={tracks.filter((t) => t.id !== selectedTrack.id && t.genre === selectedTrack.genre)}
            onSelectTrack={handleOpenTrackDetail}
            viewerProfile={profile}
            onRequireAuth={() => setIsAuthOpen(true)}
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

      <AppFooter onOpen={setLegalDocument} />

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
        user={user}
        profile={profile}
        onRequireAuth={() => setIsAuthOpen(true)}
      />

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

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onOpenTerms={() => setLegalDocument('terms')}
        onOpenPrivacy={() => setLegalDocument('privacy')}
      />
      <LegalModal document={legalDocument} onClose={() => setLegalDocument(null)} />
      <ReportModal
        track={reportModalTrack}
        onClose={() => setReportModalTrack(null)}
        onSubmit={handleReportTrack}
      />
      <Analytics />
    </div>
  );
}

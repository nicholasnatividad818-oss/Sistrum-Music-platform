import { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ActiveTab, Track, Artist, UserProfile } from '../types';
import {
  Radio,
  Search,
  Upload,
  Bell,
  Heart,
  User,
  Music,
  Compass,
  ListMusic,
  Sparkles,
  Sliders
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenUpload: () => void;
  onOpenArtistProfile: (artistId: string) => void;
  onOpenTrackDetail: (track: Track) => void;
  searchResults: { tracks: Track[]; artists: Artist[] };
  isPlaying?: boolean;
  user: SupabaseUser | null;
  profile: UserProfile | null;
  onOpenAuth: () => void;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => void;
}

export function Navbar({
  activeTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  onOpenUpload,
  onOpenArtistProfile,
  onOpenTrackDetail,
  searchResults,
  isPlaying = false,
  user,
  profile,
  onOpenAuth,
  onSignOut,
  onDeleteAccount
}: NavbarProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const hasSearchContent = searchQuery.trim().length > 0;

  return (
    <header className="sticky top-0 z-30 bg-[#0f0f14]/90 backdrop-blur-xl border-b border-neutral-800/80 select-none">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Main Nav Tabs */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div
            id="app-logo"
            onClick={() => onSelectTab('discover')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff4400] to-[#ff7700] flex items-center justify-center text-white shadow-lg shadow-[#ff5500]/30 transform group-hover:scale-105 transition-all ${
              isPlaying ? 'animate-brand-playing shadow-[#ff5500]/50' : 'animate-brand-breathe'
            }`}>
              {/* Cloud / Wave icon */}
              <Radio className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex flex-col">
              <span
                className={`text-base font-black tracking-tight text-white flex items-center gap-0.5 transition-all origin-left ${
                  isPlaying ? 'animate-brand-playing' : 'animate-brand-breathe'
                }`}
              >
                SIS<span className={`text-[#ff5500] ${isPlaying ? 'animate-brand-accent' : ''}`}>TRUM</span>
              </span>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              id="nav-tab-discover"
              onClick={() => onSelectTab('discover')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'discover'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              Discover
            </button>

            <button
              id="nav-tab-stream"
              onClick={() => onSelectTab('stream')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'stream'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              Stream
            </button>

            <button
              id="nav-tab-library"
              onClick={() => onSelectTab('library')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'library'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              Library
            </button>
          </nav>
        </div>

        {/* Center: Search Bar with Dropdown Results */}
        <div className="flex-1 max-w-md relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="Search artists, tracks, genres, podcasts..."
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-[#ff5500] rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 outline-none transition-all"
            />
          </div>

          {/* Search Dropdown Popup */}
          {isSearchFocused && hasSearchContent && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden z-50 p-3 space-y-3">
              {searchResults.tracks.length === 0 && searchResults.artists.length === 0 ? (
                <p className="text-xs text-neutral-500 py-3 text-center">No matching results found</p>
              ) : (
                <>
                  {searchResults.tracks.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block px-2 mb-1.5">
                        Tracks ({searchResults.tracks.length})
                      </span>
                      <div className="space-y-1">
                        {searchResults.tracks.slice(0, 4).map((t) => (
                          <div
                            key={t.id}
                            onMouseDown={() => onOpenTrackDetail(t)}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-800 cursor-pointer transition-colors"
                          >
                            <img src={t.coverArt} alt={t.title} className="w-8 h-8 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">{t.title}</div>
                              <div className="text-[10px] text-neutral-400 truncate">{t.artist}</div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-[#ff5500]">
                              {t.genre}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.artists.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block px-2 mb-1.5">
                        Artists ({searchResults.artists.length})
                      </span>
                      <div className="space-y-1">
                        {searchResults.artists.slice(0, 3).map((a) => (
                          <div
                            key={a.id}
                            onMouseDown={() => onOpenArtistProfile(a.id)}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-800 cursor-pointer transition-colors"
                          >
                            <img src={a.avatar} alt={a.name} className="w-8 h-8 rounded-full object-cover" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">{a.name}</div>
                              <div className="text-[10px] text-neutral-400 font-mono truncate">@{a.handle}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Upload Button & Profile */}
        <div className="flex items-center gap-3">
          {/* Upload Button */}
          <button
            id="nav-upload-btn"
            onClick={onOpenUpload}
            className="px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-[#ff5500]/25"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff5500]" />
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-4 z-50 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <h4 className="text-xs font-bold text-white">Beta updates</h4>
                </div>
                <div className="text-xs text-neutral-300 space-y-2">
                  <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
                    <p className="font-semibold text-white">You’re in the Sistrum private beta.</p>
                    <p className="text-[10px] text-neutral-400">Real-time notifications are coming in a later release.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowProfile((value) => !value)}
                className="flex items-center gap-2 rounded-full p-1 hover:ring-2 hover:ring-[#ff5500]/50"
                title="Account menu"
              >
                <img
                  src={profile?.avatarUrl || 'https://images.unsplash.com/photo-1520975958225-57c3a5b11c0b?w=100&auto=format&fit=crop&q=80'}
                  alt={profile?.displayName || 'Your profile'}
                  className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                />
              </button>
              {showProfile && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-neutral-800 bg-neutral-900 p-3 shadow-2xl">
                  <div className="mb-2 border-b border-neutral-800 px-2 pb-3">
                    <div className="truncate text-xs font-bold text-white">{profile?.displayName || user.email}</div>
                    <div className="truncate text-[10px] text-neutral-500">{user.email}</div>
                  </div>
                  <button onClick={() => { onSelectTab('library'); setShowProfile(false); }} className="w-full rounded-lg px-2 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white">Your library</button>
                  <button onClick={() => { void onSignOut(); setShowProfile(false); }} className="w-full rounded-lg px-2 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white">Sign out</button>
                  <button onClick={() => { onDeleteAccount(); setShowProfile(false); }} className="w-full rounded-lg px-2 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40">Delete account</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={onOpenAuth} className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-white hover:border-[#ff5500]">
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

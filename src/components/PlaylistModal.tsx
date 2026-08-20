import { useState, type FormEvent } from 'react';
import { Track, Playlist } from '../types';
import { X, Plus, Check, ListPlus, Music } from 'lucide-react';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track;
  playlists: Playlist[];
  onCreatePlaylist: (title: string, description: string) => void;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
}

export function PlaylistModal({
  isOpen,
  onClose,
  track,
  playlists,
  onCreatePlaylist,
  onToggleTrackInPlaylist
}: PlaylistModalProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  if (!isOpen) return null;

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreatePlaylist(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setIsCreatingNew(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <ListPlus className="w-5 h-5 text-[#ff5500]" />
            <h3 className="text-sm font-bold text-white">Add to Playlist</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Target Track */}
          <div className="flex items-center gap-3 p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <img src={track.coverArt} alt={track.title} className="w-10 h-10 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
              <p className="text-[11px] text-[#ff5500] truncate">{track.artist}</p>
            </div>
          </div>

          {/* New Playlist Form */}
          {isCreatingNew ? (
            <form onSubmit={handleCreate} className="p-3.5 bg-neutral-950/80 rounded-xl border border-[#ff5500]/40 space-y-3">
              <h4 className="text-xs font-bold text-white">Create New Playlist</h4>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Playlist Title..."
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:border-[#ff5500] outline-none"
                autoFocus
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short description (optional)..."
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-300 focus:border-[#ff5500] outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#ff5500] hover:bg-[#ff6611] text-white text-xs font-bold disabled:opacity-50"
                >
                  Save & Add
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-neutral-700 hover:border-[#ff5500] text-neutral-300 hover:text-white flex items-center justify-center gap-2 text-xs font-bold transition-colors bg-neutral-950/30"
            >
              <Plus className="w-4 h-4 text-[#ff5500]" />
              <span>Create New Playlist</span>
            </button>
          )}

          {/* Existing Playlists List */}
          <div className="space-y-2 pt-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
              Your Playlists
            </label>
            {playlists.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-2">No playlists created yet.</p>
            ) : (
              playlists.map((pl) => {
                const isIncluded = pl.trackIds.includes(track.id);
                return (
                  <div
                    key={pl.id}
                    onClick={() => onToggleTrackInPlaylist(pl.id, track.id)}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/60 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={pl.coverArt} alt={pl.title} className="w-9 h-9 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-[#ff5500] transition-colors truncate">
                          {pl.title}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                        isIncluded
                          ? 'bg-[#ff5500] border-[#ff5500] text-white'
                          : 'border-neutral-700 group-hover:border-neutral-500'
                      }`}
                    >
                      {isIncluded && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

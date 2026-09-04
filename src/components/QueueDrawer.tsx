import { Track } from '../types';
import { X, Play, Trash2, Shuffle, Music, Radio } from 'lucide-react';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  queue: Track[];
  onPlayTrack: (track: Track) => void;
  onRemoveFromQueue: (trackId: string) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
}

export function QueueDrawer({
  isOpen,
  onClose,
  currentTrack,
  queue,
  onPlayTrack,
  onRemoveFromQueue,
  onClearQueue,
  onShuffleQueue
}: QueueDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-neutral-900/95 backdrop-blur-xl border-l border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60">
        <div className="flex items-center gap-2.5">
          <Music className="w-5 h-5 text-[#ff5500]" />
          <h3 className="text-sm font-bold text-white tracking-wide">Next Up Queue</h3>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <>
              <button
                onClick={onShuffleQueue}
                title="Shuffle Queue"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={onClearQueue}
                title="Clear Queue"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Currently Playing Card */}
        {currentTrack && (
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff5500] block mb-2">
              Now Playing
            </span>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#ff5500]/10 border border-[#ff5500]/30 shadow-sm">
              <div className="relative">
                <img
                  src={currentTrack.coverArt}
                  alt={currentTrack.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <Radio className="w-4 h-4 text-[#ff5500] animate-pulse" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">{currentTrack.title}</h4>
                <p className="text-[11px] text-neutral-300 truncate">{currentTrack.artist}</p>
                <span className="text-[10px] text-[#ff5500] font-semibold">{currentTrack.genre}</span>
              </div>
            </div>
          </div>
        )}

        {/* Up Next List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              In Queue ({queue.length})
            </span>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Your queue is empty</p>
              <p className="text-[10px] text-neutral-600 mt-1">Add songs from the stream or discovery page</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  className="group flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/40 hover:bg-neutral-800/80 border border-neutral-800/60 transition-all cursor-pointer"
                  onClick={() => onPlayTrack(track)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-neutral-500 w-4 text-center">{idx + 1}</span>
                    <img src={track.coverArt} alt={track.title} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                        {track.title}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate">{track.artist}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromQueue(track.id);
                      }}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-700/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


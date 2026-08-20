import { useState } from 'react';
import { Track } from '../types';
import { X, Copy, Check, Share2, Twitter, Facebook, Code } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track;
}

export function ShareModal({ isOpen, onClose, track }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/track/${track.id}`;
  const embedCode = `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="${shareUrl}?embed=true"></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-[#ff5500]" />
            <h3 className="text-sm font-bold text-white">Share this Track</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Mini Track Preview */}
          <div className="flex items-center gap-3 p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <img src={track.coverArt} alt={track.title} className="w-12 h-12 rounded-lg object-cover" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
              <p className="text-[11px] text-[#ff5500] truncate">{track.artist}</p>
            </div>
          </div>

          {/* Copy Link */}
          <div>
            <label className="text-xs font-semibold text-neutral-400 block mb-1.5">Direct Share Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 flex-1 outline-none font-mono"
              />
              <button
                id="copy-share-link-btn"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Embed Code */}
          <div>
            <label className="text-xs font-semibold text-neutral-400 block mb-1.5 flex items-center gap-1">
              <Code className="w-3.5 h-3.5 text-[#ff5500]" />
              <span>Embed Player HTML</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={embedCode}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-[11px] text-neutral-400 flex-1 outline-none font-mono truncate"
              />
              <button
                onClick={handleCopyEmbed}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors shrink-0"
              >
                {copiedEmbed ? 'Copied' : 'Copy HTML'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

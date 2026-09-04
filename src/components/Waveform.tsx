import { useState, useRef, MouseEvent } from 'react';
import { Comment } from '../types';
import { MessageSquare } from 'lucide-react';

interface WaveformProps {
  waveformData: number[];
  duration: number;
  currentTime: number;
  isPlaying?: boolean;
  onSeek: (seconds: number) => void;
  comments?: Comment[];
  onCommentClick?: (comment: Comment) => void;
  onWaveformClickTimestamp?: (seconds: number) => void;
  height?: number; // e.g. 60, 80, 100
  showComments?: boolean;
  interactive?: boolean;
  barWidth?: number;
  barGap?: number;
  colorScheme?: 'orange' | 'cyan' | 'purple';
}

export function Waveform({
  waveformData,
  duration,
  currentTime,
  isPlaying = false,
  onSeek,
  comments = [],
  onCommentClick,
  onWaveformClickTimestamp,
  height = 72,
  showComments = true,
  interactive = true,
  barWidth = 3,
  barGap = 2,
  colorScheme = 'orange'
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; percent: number; seconds: number } | null>(null);
  const [activeHoverComment, setActiveHoverComment] = useState<Comment | null>(null);

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !interactive) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const seconds = percent * duration;
    setHoverPosition({ x, percent: percent * 100, seconds });
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !interactive) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const seconds = percent * duration;
    onSeek(seconds);
    if (onWaveformClickTimestamp) {
      onWaveformClickTimestamp(seconds);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Color mappings
  const playedColors = {
    orange: 'from-[#ff5500] to-[#ff7700] bg-[#ff5500]',
    cyan: 'from-cyan-500 to-teal-400 bg-cyan-500',
    purple: 'from-purple-500 to-indigo-400 bg-purple-500'
  };

  return (
    <div
      id="waveform-container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ height: `${height}px` }}
      className={`relative w-full select-none ${interactive ? 'cursor-pointer' : ''} flex flex-col justify-end group`}
    >
      {/* Bars Container */}
      <div className="relative w-full h-full flex items-end justify-between gap-[2px] overflow-hidden">
        {waveformData.map((val, idx) => {
          const barPercent = (idx / waveformData.length) * 100;
          const isPlayed = barPercent <= progressPercent;
          const isHovered = hoverPosition && barPercent <= hoverPosition.percent;
          
          // Normalized bar height calculation
          const barHeightPercent = Math.max(12, Math.min(100, val * 100));

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col justify-end items-center h-full transition-all duration-75"
            >
              {/* Waveform Bar Top (Main Body) */}
              <div
                style={{ height: `${barHeightPercent}%` }}
                className={`w-full rounded-t-sm transition-colors duration-100 ${
                  isPlayed
                    ? colorScheme === 'orange'
                      ? 'bg-[#ff5500]'
                      : colorScheme === 'cyan'
                      ? 'bg-cyan-500'
                      : 'bg-purple-500'
                    : isHovered
                    ? 'bg-neutral-400 dark:bg-neutral-500'
                    : 'bg-neutral-600/60 dark:bg-neutral-700/80 hover:bg-neutral-500'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Hover Scrub Line & Tooltip */}
      {hoverPosition && (
        <>
          <div
            className="absolute top-0 bottom-0 w-[1.5px] bg-white z-20 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            style={{ left: `${hoverPosition.x}px` }}
          />
          <div
            className="absolute -top-7 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-900/90 text-white shadow-md border border-neutral-700 pointer-events-none z-30 transform -translate-x-1/2"
            style={{ left: `${hoverPosition.x}px` }}
          >
            {formatTime(hoverPosition.seconds)}
          </div>
        </>
      )}

      {/* Progress Playhead Line */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white z-10 pointer-events-none shadow-[0_0_10px_#ff5500]"
        style={{ left: `${progressPercent}%` }}
      />

      {/* Timed Comments Avatars along the waveform bottom */}
      {showComments && comments.length > 0 && (
        <div className="absolute -bottom-3 left-0 right-0 h-6 pointer-events-auto z-20">
          {comments.map((cmt) => {
            const cmtPercent = duration > 0 ? (cmt.timestamp / duration) * 100 : 0;
            return (
              <div
                key={cmt.id}
                id={`comment-marker-${cmt.id}`}
                className="absolute transform -translate-x-1/2 group/cmt z-20"
                style={{ left: `${cmtPercent}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(cmt.timestamp);
                  if (onCommentClick) onCommentClick(cmt);
                }}
                onMouseEnter={() => setActiveHoverComment(cmt)}
                onMouseLeave={() => setActiveHoverComment(null)}
              >
                <img
                  src={cmt.userAvatar}
                  alt={cmt.userName}
                  className="w-5 h-5 rounded-full border-2 border-neutral-900 shadow-md hover:scale-135 transition-transform object-cover cursor-pointer hover:border-[#ff5500]"
                />

                {/* Comment Tooltip Popup on Hover */}
                <div className="hidden group-hover/cmt:flex flex-col absolute bottom-7 left-1/2 transform -translate-x-1/2 bg-neutral-900 text-white text-xs p-2.5 rounded-lg shadow-xl border border-neutral-700 min-w-[160px] max-w-[240px] z-50 pointer-events-none">
                  <div className="flex items-center justify-between gap-1 text-[10px] text-[#ff5500] font-semibold mb-0.5">
                    <span>{cmt.userName}</span>
                    <span className="text-neutral-400 font-mono">@{formatTime(cmt.timestamp)}</span>
                  </div>
                  <p className="text-neutral-200 text-xs line-clamp-2 leading-relaxed">
                    {cmt.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


'use client';

import React, { useState } from 'react';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { formatDuration } from '@/lib/serialize';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Loader2,
  Music,
  AlertCircle,
} from 'lucide-react';

export function AudioPreviewPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    isLoading,
    playbackError,
    togglePlay,
    seek,
    skip,
    setVolume,
    setPlaybackRate,
    clearPlaybackError,
    closePlayer,
  } = useAudioPlayer();

  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  if (!currentTrack) {
    return null;
  }

  const effectiveDuration = duration || currentTrack.duration || 0;
  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume || 1);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
    }
  };

  const speedOptions = [0.75, 1, 1.25, 1.5, 2];

  const handleNextSpeed = () => {
    const currentIndex = speedOptions.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speedOptions.length;
    setPlaybackRate(speedOptions[nextIndex]);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 dark:bg-slate-950/95 text-white border-t border-slate-800 shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom duration-200">
      {/* Playback Error Notice Banner */}
      {playbackError && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-1.5 text-center text-xs text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 mx-auto">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{playbackError}</span>
          </div>
          <button
            onClick={clearPlaybackError}
            className="text-amber-400 hover:text-white underline text-[11px] shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Interactive Progress Bar across top of player */}
      <div
        className="w-full h-1.5 bg-slate-800 hover:h-2.5 transition-all cursor-pointer relative group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          seek(ratio * effectiveDuration);
        }}
      >
        <div
          className="h-full bg-emerald-500 relative transition-all"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0 max-w-[280px] sm:max-w-xs md:max-w-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800/80 flex items-center justify-center shrink-0 text-emerald-400">
            <Music className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-100 truncate">
                {currentTrack.title}
              </p>
              {currentTrack.categoryTitle && (
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {currentTrack.categoryTitle}
                </span>
              )}
            </div>
            {currentTrack.amharicTitle ? (
              <p className="text-[11px] text-emerald-400/90 truncate font-sans">
                {currentTrack.amharicTitle}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {currentTrack.id}
              </p>
            )}
          </div>
        </div>

        {/* Center Controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Skip Backward 10s */}
            <button
              onClick={() => skip(-10)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={() => skip(10)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span>{formatDuration(currentTime)}</span>
            <span>/</span>
            <span>{formatDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* Right Tools (Speed, Volume, Close) */}
        <div className="flex items-center gap-3">
          {/* Playback Rate Toggle */}
          <button
            onClick={handleNextSpeed}
            className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
            title="Playback Speed"
          >
            {playbackRate}x
          </button>

          {/* Volume Control */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                if (isMuted) setIsMuted(false);
                setVolume(parseFloat(e.target.value));
              }}
              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Close Player */}
          <button
            onClick={closePlayer}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
            title="Close Player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

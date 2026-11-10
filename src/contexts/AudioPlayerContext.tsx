'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

export interface ActiveTrack {
  id: string;
  title: string;
  amharicTitle?: string | null;
  moduleTitle?: string;
  categoryTitle?: string;
  remoteUrl: string;
  localBlobUrl?: string;
  duration: number;
}

interface AudioPlayerContextType {
  currentTrack: ActiveTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isLoading: boolean;
  playbackError: string | null;
  playTrack: (track: ActiveTrack) => void;
  togglePlay: () => void;
  seek: (timeInSeconds: number) => void;
  skip: (deltaSeconds: number) => void;
  setVolume: (v: number) => void;
  setPlaybackRate: (rate: number) => void;
  clearPlaybackError: () => void;
  closePlayer: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<ActiveTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio instance on client
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
      setPlaybackError(null);
    };

    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => {
      setIsLoading(false);
      setPlaybackError(null);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      console.warn('[AudioPlayer] Audio resource failed to load (e.g. unconfigured dev CDN URL)');
      setPlaybackError(
        'Unable to load audio resource. In dev simulation mode, newly uploaded files require configured cloud storage or local file preview.'
      );
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const playTrack = useCallback((track: ActiveTrack) => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // Toggle if same track clicked
    if (currentTrack?.id === track.id) {
      if (audio.paused) {
        setPlaybackError(null);
        audio.play().catch((err: unknown) => {
          console.warn('[AudioPlayer] resume failed gracefully:', err);
          setPlaybackError('Unable to resume playback of this audio track.');
        });
      } else {
        audio.pause();
      }
      return;
    }

    setPlaybackError(null);
    setCurrentTrack(track);
    setIsLoading(true);

    // Prefer local in-memory blob for staged/just-uploaded files if available
    const audioSource = track.localBlobUrl || track.remoteUrl;
    audio.src = audioSource;
    audio.currentTime = 0;
    audio.playbackRate = playbackRate;
    audio.volume = volume;

    audio.play().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[AudioPlayer] Playback was not supported or failed gracefully:', msg);
      setIsLoading(false);
      setIsPlaying(false);
      setPlaybackError(
        track.remoteUrl.includes('cdn.sheikhzabur.com')
          ? 'Cloud storage is currently in Dev Simulation Mode. Set Cloudflare R2 credentials or STORAGE_PUBLIC_BASE_URL in .env to stream uploaded files.'
          : 'Unable to stream audio track from remote server.'
      );
    });
  }, [currentTrack?.id, playbackRate, volume]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setPlaybackError(null);
      audioRef.current.play().catch((err: unknown) => {
        console.warn('[AudioPlayer] Playback failed gracefully:', err);
        setPlaybackError('Unable to stream this audio track.');
      });
    }
  }, [currentTrack, isPlaying]);

  const seek = useCallback((timeInSeconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = timeInSeconds;
    setCurrentTime(timeInSeconds);
  }, []);

  const skip = useCallback((deltaSeconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(audioRef.current.duration || 999999, audioRef.current.currentTime + deltaSeconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const clearPlaybackError = useCallback(() => {
    setPlaybackError(null);
  }, []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playbackRate,
        isLoading,
        playbackError,
        playTrack,
        togglePlay,
        seek,
        skip,
        setVolume,
        setPlaybackRate,
        clearPlaybackError,
        closePlayer,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextType {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}

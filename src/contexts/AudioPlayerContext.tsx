'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

export interface ActiveTrack {
  id: string;
  title: string;
  oromoTitle?: string | null;
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
  const currentTrackRef = useRef<ActiveTrack | null>(null);
  const attemptedProxyFallbackRef = useRef<boolean>(false);

  // Synchronize ref with state
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Helper to determine optimal initial audio source
  const getAudioSourceUrl = useCallback((track: ActiveTrack, forceProxy = false): string => {
    if (track.localBlobUrl) return track.localBlobUrl;
    if (forceProxy) {
      return `/api/v1/audio/stream?url=${encodeURIComponent(track.remoteUrl)}`;
    }
    // If running under HTTPS and remoteUrl is insecure HTTP, route through proxy to prevent mixed content
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      track.remoteUrl.startsWith('http://')
    ) {
      return `/api/v1/audio/stream?url=${encodeURIComponent(track.remoteUrl)}`;
    }
    return track.remoteUrl;
  }, []);

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
      // If direct playback encountered an error, attempt server stream proxy fallback before showing error
      const track = currentTrackRef.current;
      if (track?.remoteUrl && !track.localBlobUrl && !attemptedProxyFallbackRef.current) {
        attemptedProxyFallbackRef.current = true;
        console.warn('[AudioPlayer] Audio load error, retrying via server stream proxy...');
        audio.src = `/api/v1/audio/stream?url=${encodeURIComponent(track.remoteUrl)}`;
        audio.play().catch((err: unknown) => {
          const errorName = err instanceof Error ? err.name : '';
          if (errorName === 'AbortError') return;
          setIsLoading(false);
          setIsPlaying(false);
          setPlaybackError(
            track.remoteUrl.includes('cdn.sheikhzabur.com')
              ? 'Cloud storage is currently in Dev Simulation Mode. Set Cloudflare R2 credentials or STORAGE_PUBLIC_BASE_URL in .env to stream uploaded files.'
              : 'Unable to stream audio track from remote server.'
          );
        });
        return;
      }

      setIsLoading(false);
      setIsPlaying(false);
      console.warn('[AudioPlayer] Audio resource failed to load');
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

  const playTrack = useCallback(
    (track: ActiveTrack) => {
      if (!audioRef.current) return;
      const audio = audioRef.current;

      // Toggle if same track clicked
      if (currentTrack?.id === track.id) {
        if (audio.paused) {
          setPlaybackError(null);
          audio.play().catch((err: unknown) => {
            const errorName = err instanceof Error ? err.name : '';
            if (errorName === 'AbortError') return;
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
      attemptedProxyFallbackRef.current = false;

      const playWithFallback = (sourceUrl: string, isFallback = false) => {
        audio.src = sourceUrl;
        try {
          if (audio.currentTime > 0) {
            audio.currentTime = 0;
          }
        } catch {}
        audio.playbackRate = playbackRate;
        audio.volume = volume;

        audio.play().catch((err: unknown) => {
          const errorName = err instanceof Error ? err.name : '';
          // AbortError is benign (user paused or switched tracks before buffer completed)
          if (errorName === 'AbortError') return;

          // If direct URL failed and hasn't tried proxy yet, fallback to server stream proxy
          if (!isFallback && track.remoteUrl && !track.localBlobUrl) {
            console.warn('[AudioPlayer] Direct playback failed, falling back to server stream proxy...');
            attemptedProxyFallbackRef.current = true;
            const proxyUrl = `/api/v1/audio/stream?url=${encodeURIComponent(track.remoteUrl)}`;
            playWithFallback(proxyUrl, true);
            return;
          }

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
      };

      const initialSource = getAudioSourceUrl(track);
      playWithFallback(initialSource, initialSource.startsWith('/api/'));
    },
    [currentTrack?.id, getAudioSourceUrl, playbackRate, volume]
  );

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

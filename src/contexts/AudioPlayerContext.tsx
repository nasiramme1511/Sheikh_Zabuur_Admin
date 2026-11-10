'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

export interface ActiveTrack {
  id: string;
  title: string;
  amharicTitle?: string | null;
  moduleTitle?: string;
  categoryTitle?: string;
  remoteUrl: string;
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
  playTrack: (track: ActiveTrack) => void;
  togglePlay: () => void;
  seek: (timeInSeconds: number) => void;
  skip: (deltaSeconds: number) => void;
  setVolume: (v: number) => void;
  setPlaybackRate: (rate: number) => void;
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
    };

    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      console.warn('[AudioPlayer] Error playing audio source');
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

    if (currentTrack?.id === track.id) {
      if (audio.paused) {
        audio.play().catch(console.error);
      } else {
        audio.pause();
      }
      return;
    }

    setCurrentTrack(track);
    setIsLoading(true);
    audio.src = track.remoteUrl;
    audio.currentTime = 0;
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.play().catch((err) => {
      console.error('[AudioPlayer] play failed:', err);
      setIsLoading(false);
    });
  }, [currentTrack?.id, playbackRate, volume]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
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

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
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
        playTrack,
        togglePlay,
        seek,
        skip,
        setVolume,
        setPlaybackRate,
        closePlayer,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}

'use client';

import React, { useState, useEffect } from 'react';
import { formatBytes, formatDuration } from '@/lib/serialize';
import {
  X,
  Save,
  Loader2,
  AlertCircle,
  Lock,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export interface AudioTrackItem {
  id: string;
  moduleId: string;
  categoryId: string;
  trackNumber: number;
  trackOrder: number;
  title: string;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  duration: number;
  fileSize: number;
  originalFilename: string;
  storageKey: string;
  remoteUrl: string;
  isPublished: boolean;
  module?: {
    id: string;
    title: string;
    amharicTitle?: string | null;
  };
  category?: {
    id: string;
    title: string;
    amharicTitle?: string | null;
  };
}

interface TrackEditModalProps {
  track: AudioTrackItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedTrack: AudioTrackItem) => void;
}

export function TrackEditModal({
  track,
  isOpen,
  onClose,
  onSuccess,
}: TrackEditModalProps) {
  const [title, setTitle] = useState('');
  const [amharicTitle, setAmharicTitle] = useState('');
  const [arabicTitle, setArabicTitle] = useState('');
  const [trackNumber, setTrackNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setAmharicTitle(track.amharicTitle || '');
      setArabicTitle(track.arabicTitle || '');
      setTrackNumber(track.trackNumber || 1);
      setIsPublished(track.isPublished ?? true);
      setError(null);
    }
  }, [track]);

  if (!isOpen || !track) {
    return null;
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(track.remoteUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/tracks/${track.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          amharicTitle: amharicTitle.trim() || null,
          arabicTitle: arabicTitle.trim() || null,
          trackNumber: Number(trackNumber),
          isPublished,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update track');
      }

      onSuccess(data.track);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Edit Audio Track
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Lock className="w-3 h-3 text-slate-400" />
                ID: {track.id}
              </span>
              <span className="text-xs text-slate-400">• Mobile Key Immutable</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Module & Category Info Card */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
            <div>
              <span className="text-slate-400 font-medium">Curriculum Module:</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {track.module?.title || track.moduleId}
              </p>
              {track.module?.amharicTitle && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans">
                  {track.module.amharicTitle}
                </p>
              )}
            </div>
            <div>
              <span className="text-slate-400 font-medium">Category:</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {track.category?.title || track.categoryId}
              </p>
              {track.category?.amharicTitle && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans">
                  {track.category.amharicTitle}
                </p>
              )}
            </div>
          </div>

          {/* Title Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Track Title (System & Mobile Display) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Darse 01 - Al-Bayquniyyah"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Track Number
              </label>
              <input
                type="number"
                min="1"
                value={trackNumber}
                onChange={(e) => setTrackNumber(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Amharic Title (የአማርኛ ርዕስ)
              </label>
              <input
                type="text"
                value={amharicTitle}
                onChange={(e) => setAmharicTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="ለምሳሌ፡ ደርስ ፩"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Arabic Title (العنوان بالعربية)
              </label>
              <input
                type="text"
                dir="rtl"
                value={arabicTitle}
                onChange={(e) => setArabicTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right font-sans"
                placeholder="مثال: الدرس الأول"
              />
            </div>
          </div>

          {/* Publication Toggle */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Publication Status
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Only published tracks are compiled into public catalog releases for the mobile app.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Technical Audio Metadata Read-only Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
              Audio File & Storage Details
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="text-slate-500">Duration:</span>
                <p className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatDuration(track.duration)}
                </p>
              </div>
              <div>
                <span className="text-slate-500">File Size:</span>
                <p className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatBytes(track.fileSize)}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Original Filename:</span>
                <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate mt-0.5">
                  {track.originalFilename}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-500 shrink-0">CDN URL:</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate">
                  {track.remoteUrl}
                </p>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
                  title="Copy URL"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={track.remoteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

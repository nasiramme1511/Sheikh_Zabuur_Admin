'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { formatBytes, formatDuration } from '@/lib/serialize';
import {
  UploadCloud,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  X,
  Loader2,
  HardDrive,
  Info,
  Server,
  Sparkles,
} from 'lucide-react';

interface ModuleOption {
  id: string;
  title: string;
  amharicTitle?: string | null;
  categories: {
    id: string;
    title: string;
    amharicTitle?: string | null;
    trackCount?: number;
  }[];
}

interface StagedFile {
  id: string;
  file: File;
  title: string;
  amharicTitle: string;
  arabicTitle: string;
  trackNumber: number;
  duration: number; // in seconds
  fileSize: number;
  isPublished: boolean;
  status: 'idle' | 'presigning' | 'uploading' | 'completing' | 'done' | 'error';
  progress: number;
  errorMessage?: string;
  uploadedTrack?: {
    id: string;
    remoteUrl: string;
    title: string;
  };
}

interface StorageStatus {
  configured: boolean;
  provider: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
}

export default function UploadPage() {
  const { playTrack } = useAudioPlayer();

  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load modules & storage status on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [modRes, statusRes] = await Promise.all([
          fetch('/api/admin/modules'),
          fetch('/api/admin/uploads/status'),
        ]);

        if (modRes.ok) {
          const modData = await modRes.json();
          const mods: ModuleOption[] = modData.modules || [];
          setModules(mods);
          if (mods.length > 0) {
            setSelectedModuleId(mods[0].id);
            if (mods[0].categories.length > 0) {
              setSelectedCategoryId(mods[0].categories[0].id);
            }
          }
        }

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setStorageStatus(statusData);
        }
      } catch (err) {
        console.error('Failed to load initial upload data:', err);
      }
    }
    loadInitialData();
  }, []);

  const selectedModule = modules.find((m) => m.id === selectedModuleId);
  const availableCategories = selectedModule?.categories || [];
  const selectedCategory = availableCategories.find((c) => c.id === selectedCategoryId);

  // Extract duration from audio file client-side
  const inspectAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        const dur = Math.round(audio.duration || 0);
        URL.revokeObjectURL(url);
        resolve(dur);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };

      audio.src = url;
    });
  };

  const cleanFilenameToTitle = (rawName: string): string => {
    return rawName
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[_-]+/g, ' ') // replace dashes/underscores with space
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const baseTrackNumber = (selectedCategory?.trackCount || 0) + stagedFiles.length + 1;
    const newItems: StagedFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const duration = await inspectAudioDuration(file);
      const cleanTitle = cleanFilenameToTitle(file.name);

      newItems.push({
        id: `${file.name}-${Date.now()}-${i}`,
        file,
        title: cleanTitle,
        amharicTitle: '',
        arabicTitle: '',
        trackNumber: baseTrackNumber + i,
        duration: duration || 60, // default 1 min if unreadable in headless
        fileSize: file.size,
        isPublished: false,
        status: 'idle',
        progress: 0,
      });
    }

    setStagedFiles((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const updateStagedItem = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeStagedItem = (id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const uploadSingleFile = async (item: StagedFile): Promise<boolean> => {
    if (!selectedModuleId || !selectedCategoryId) {
      updateStagedItem(item.id, {
        status: 'error',
        errorMessage: 'Please select a module and category before uploading',
      });
      return false;
    }

    try {
      // 1. Request presigned upload URL
      updateStagedItem(item.id, { status: 'presigning', progress: 5 });

      const presignRes = await fetch('/api/admin/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type || 'audio/mpeg',
          fileSize: item.file.size,
          moduleId: selectedModuleId,
          categoryId: selectedCategoryId,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.error || 'Failed to acquire presigned URL');
      }

      const { uploadUrl, storageKey, remoteUrl } = presignData;

      // 2. Direct client-to-cloud upload via XMLHttpRequest to track progress
      updateStagedItem(item.id, { status: 'uploading', progress: 10 });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', item.file.type || 'audio/mpeg');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 80) + 10; // 10% to 90%
            updateStagedItem(item.id, { progress: pct });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage returned HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload to cloud storage'));
        xhr.send(item.file);
      });

      // 3. Complete and record track in PostgreSQL
      updateStagedItem(item.id, { status: 'completing', progress: 95 });

      const completeRes = await fetch('/api/admin/uploads/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey,
          remoteUrl,
          originalFilename: item.file.name,
          moduleId: selectedModuleId,
          categoryId: selectedCategoryId,
          title: item.title,
          amharicTitle: item.amharicTitle.trim() || null,
          arabicTitle: item.arabicTitle.trim() || null,
          duration: item.duration,
          fileSize: item.fileSize,
          trackNumber: item.trackNumber,
          isPublished: item.isPublished,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData.error || 'Failed to persist uploaded track in database');
      }

      updateStagedItem(item.id, {
        status: 'done',
        progress: 100,
        uploadedTrack: completeData.track,
      });

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      updateStagedItem(item.id, {
        status: 'error',
        errorMessage: msg,
      });
      return false;
    }
  };

  const uploadAll = async () => {
    setIsUploadingAll(true);
    const pending = stagedFiles.filter((f) => f.status === 'idle' || f.status === 'error');

    for (const item of pending) {
      await uploadSingleFile(item);
    }
    setIsUploadingAll(false);
  };

  const completedCount = stagedFiles.filter((f) => f.status === 'done').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <UploadCloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Cloud Audio Upload Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Direct-to-cloud upload pipeline for Sheikh Zabuur recordings with automated metadata extraction.
          </p>
        </div>

        {/* Storage Status Badge */}
        {storageStatus && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm self-start sm:self-auto">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Storage:</span>
            {storageStatus.configured ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Cloudflare R2 ({storageStatus.bucket})
              </span>
            ) : (
              <span className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1" title="Set STORAGE_ACCESS_KEY_ID in .env for production">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Dev Simulation Mode
              </span>
            )}
          </div>
        )}
      </div>

      {/* Target Module & Category Selector */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-emerald-600" />
          Step 1: Select Target Curriculum & Category
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Curriculum Module <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedModuleId}
              onChange={(e) => {
                const newModId = e.target.value;
                setSelectedModuleId(newModId);
                const mod = modules.find((m) => m.id === newModId);
                if (mod && mod.categories.length > 0) {
                  setSelectedCategoryId(mod.categories[0].id);
                } else {
                  setSelectedCategoryId('');
                }
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} {m.amharicTitle ? `(${m.amharicTitle})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Target Category <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.trackCount ?? 0} existing tracks)
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCategory && (
          <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Target Category: <strong>{selectedCategory.title}</strong> • Current tracks in database: <strong>{selectedCategory.trackCount ?? 0}</strong> • Next track number will begin at <strong>{(selectedCategory.trackCount ?? 0) + 1}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Drag & Drop File Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/mp3,audio/mpeg,audio/m4a,audio/x-m4a,audio/aac,audio/wav,audio/ogg"
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drop Sheikh Zabuur audio recordings here, or <span className="text-emerald-600 dark:text-emerald-400 underline">browse</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          Supports MP3, M4A, AAC, WAV, and OGG formats up to 250 MB per file. Direct-to-cloud upload bypasses server memory limits.
        </p>
      </div>

      {/* Staged Uploads List */}
      {stagedFiles.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Staged Files ({stagedFiles.length})</span>
                {completedCount > 0 && (
                  <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                    ({completedCount} completed)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Review and adjust track titles and numbers before initiating upload.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {completedCount > 0 && (
                <button
                  onClick={() => setStagedFiles((prev) => prev.filter((f) => f.status !== 'done'))}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Clear Completed
                </button>
              )}

              <button
                onClick={uploadAll}
                disabled={isUploadingAll || stagedFiles.every((f) => f.status === 'done')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                {isUploadingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading Queue...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Upload All ({stagedFiles.filter((f) => f.status !== 'done').length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stagedFiles.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* File Metadata Header */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400">
                      <FileAudio className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                        <span>{formatBytes(item.fileSize)}</span>
                        <span>•</span>
                        <span>{formatDuration(item.duration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status / Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {item.status === 'idle' && (
                      <button
                        onClick={() => uploadSingleFile(item)}
                        disabled={isUploadingAll}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                      >
                        Upload
                      </button>
                    )}

                    {item.status === 'done' && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Uploaded</span>
                        </span>

                        {item.uploadedTrack && (
                          <button
                            onClick={() =>
                              playTrack({
                                id: item.uploadedTrack!.id,
                                title: item.title,
                                amharicTitle: item.amharicTitle,
                                remoteUrl: item.uploadedTrack!.remoteUrl,
                                duration: item.duration,
                              })
                            }
                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Play uploaded track preview"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                      </div>
                    )}

                    {item.status === 'error' && (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Failed</span>
                      </span>
                    )}

                    {item.status === 'idle' && (
                      <button
                        onClick={() => removeStagedItem(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Remove from queue"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata Editable Inputs */}
                {item.status !== 'done' && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Title (ርዕስ)
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateStagedItem(item.id, { title: e.target.value })}
                        disabled={item.status !== 'idle' && item.status !== 'error'}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Amharic Title (የአማርኛ ርዕስ)
                      </label>
                      <input
                        type="text"
                        value={item.amharicTitle}
                        onChange={(e) => updateStagedItem(item.id, { amharicTitle: e.target.value })}
                        disabled={item.status !== 'idle' && item.status !== 'error'}
                        placeholder="ደርስ ፩"
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Track #
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.trackNumber}
                        onChange={(e) =>
                          updateStagedItem(item.id, { trackNumber: parseInt(e.target.value) || 1 })
                        }
                        disabled={item.status !== 'idle' && item.status !== 'error'}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {(item.status === 'presigning' ||
                  item.status === 'uploading' ||
                  item.status === 'completing') && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {item.status === 'presigning' && 'Acquiring presigned URL...'}
                        {item.status === 'uploading' && `Uploading directly to cloud storage (${item.progress}%)...`}
                        {item.status === 'completing' && 'Recording audio track in PostgreSQL...'}
                      </span>
                      <span className="font-mono">{item.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-150"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {item.status === 'error' && item.errorMessage && (
                  <div className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.errorMessage}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Tracks Quick Navigation */}
      {completedCount > 0 && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                {completedCount} recording{completedCount > 1 ? 's' : ''} successfully uploaded and registered!
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                New tracks are saved as drafts and ready to be compiled into the next catalog release in Phase 6.
              </p>
            </div>
          </div>

          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors shrink-0"
          >
            <span>View in Audio Library</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}


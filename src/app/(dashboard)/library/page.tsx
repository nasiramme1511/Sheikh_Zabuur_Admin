'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { TrackEditModal, AudioTrackItem } from '@/components/tracks/TrackEditModal';
import { formatBytes, formatDuration } from '@/lib/serialize';
import {
  Search,
  RefreshCw,
  Play,
  Pause,
  Edit2,
  CheckCircle2,
  Music,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Loader2,
  X,
} from 'lucide-react';

interface ModuleOption {
  id: string;
  title: string;
  amharicTitle?: string | null;
}

interface CategoryOption {
  id: string;
  title: string;
  amharicTitle?: string | null;
  moduleId: string;
}

export default function AudioLibraryPage() {
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('trackNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Data & Loading State
  const [tracks, setTracks] = useState<AudioTrackItem[]>([]);
  const [totalTracks, setTotalTracks] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, startTransition] = useTransition();

  // Edit Modal State
  const [editingTrack, setEditingTrack] = useState<AudioTrackItem | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Modules & Categories for filter dropdowns
  useEffect(() => {
    async function loadFilters() {
      try {
        const [modRes, catRes] = await Promise.all([
          fetch('/api/admin/modules'),
          fetch('/api/admin/categories'),
        ]);

        if (modRes.ok) {
          const modData = await modRes.json();
          setModules(modData.modules || []);
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
        }
      } catch (err) {
        console.error('Failed to load module/category filters:', err);
      }
    }
    loadFilters();
  }, []);

  // Fetch Tracks from API
  const fetchTracks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: debouncedSearch,
        moduleId: selectedModule,
        categoryId: selectedCategory,
        status: statusFilter,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/admin/tracks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to query tracks');

      const data = await res.json();
      startTransition(() => {
        setTracks(data.tracks || []);
        setTotalTracks(data.total || 0);
        setTotalPages(data.totalPages || 1);
      });
    } catch (err) {
      console.error('Error fetching tracks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedModule, selectedCategory, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // Filtered categories according to selected module
  const availableCategories = selectedModule
    ? categories.filter((c) => c.moduleId === selectedModule)
    : categories;

  const handleTrackUpdated = (updated: AudioTrackItem) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Music className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Audio Library Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse, search, edit metadata, and audit 1,731 audio tracks across all 8 curriculum modules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchTracks()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            title="Refresh tracks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, Amharic title, track ID, or file name..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setSelectedCategory('');
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All 8 Modules</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} {m.amharicTitle ? `(${m.amharicTitle})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Categories ({availableCategories.length})</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-36">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft Only</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary & Sort Options */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Showing {tracks.length} of {totalTracks.toLocaleString()} tracks</span>
            {(selectedModule || selectedCategory || statusFilter !== 'all' || debouncedSearch) && (
              <button
                onClick={() => {
                  setSelectedModule('');
                  setSelectedCategory('');
                  setStatusFilter('all');
                  setSearch('');
                  setPage(1);
                }}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium ml-2"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent border-0 font-medium text-slate-700 dark:text-slate-300 focus:ring-0 p-0 text-[11px] cursor-pointer"
              >
                <option value="trackNumber">Track #</option>
                <option value="title">Title</option>
                <option value="duration">Duration</option>
                <option value="fileSize">File Size</option>
                <option value="createdAt">Created</option>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]"
                title="Toggle sort direction"
              >
                {sortOrder.toUpperCase()}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent border-0 font-medium text-slate-700 dark:text-slate-300 focus:ring-0 p-0 text-[11px] cursor-pointer"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Track Information</th>
                <th className="py-3 px-4">Module & Category</th>
                <th className="py-3 px-4">Duration & Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading && tracks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Loading audio recordings...</span>
                  </td>
                </tr>
              ) : tracks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FileQuestion className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">No tracks found</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try broadening your search or resetting filters.</p>
                  </td>
                </tr>
              ) : (
                tracks.map((track) => {
                  const isCurrentPlaying = currentTrack?.id === track.id && isPlaying;
                  const isCurrent = currentTrack?.id === track.id;

                  return (
                    <tr
                      key={track.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Track # */}
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-500">
                        {track.trackNumber}
                      </td>

                      {/* Track Details */}
                      <td className="py-3 px-4 max-w-xs sm:max-w-md">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {track.title}
                        </div>
                        {track.amharicTitle && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-sans truncate mt-0.5">
                            {track.amharicTitle}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                          ID: {track.id}
                        </div>
                      </td>

                      {/* Module & Category */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                            {track.module?.title || track.moduleId}
                          </span>
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
                              {track.category?.title || track.categoryId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Duration & Size */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div>{formatDuration(track.duration)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{formatBytes(track.fileSize)}</div>
                      </td>

                      {/* Publication Status */}
                      <td className="py-3 px-4">
                        {track.isPublished ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Play / Preview Button */}
                          <button
                            onClick={() => {
                              if (isCurrent) {
                                togglePlay();
                              } else {
                                playTrack({
                                  id: track.id,
                                  title: track.title,
                                  amharicTitle: track.amharicTitle,
                                  moduleTitle: track.module?.title,
                                  categoryTitle: track.category?.title,
                                  remoteUrl: track.remoteUrl,
                                  duration: track.duration,
                                });
                              }
                            }}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isCurrentPlaying
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            title={isCurrentPlaying ? 'Pause preview' : 'Play audio preview'}
                          >
                            {isCurrentPlaying ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                          </button>

                          {/* Edit Metadata Button */}
                          <button
                            onClick={() => setEditingTrack(track)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Edit metadata"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold">{Math.min(totalTracks, (page - 1) * limit + 1)}</span> to{' '}
            <span className="font-semibold">{Math.min(totalTracks, page * limit)}</span> of{' '}
            <span className="font-semibold">{totalTracks.toLocaleString()}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <TrackEditModal
        track={editingTrack}
        isOpen={!!editingTrack}
        onClose={() => setEditingTrack(null)}
        onSuccess={handleTrackUpdated}
      />
    </div>
  );
}

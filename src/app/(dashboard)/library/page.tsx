'use client';

import { AudioTrackItem, TrackEditModal } from '@/components/tracks/TrackEditModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { formatBytes, formatDuration } from '@/lib/serialize';
import {
    ChevronLeft,
    ChevronRight,
    Edit2,
    FileQuestion,
    Loader2,
    Music,
    Pause,
    Play,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';

interface ModuleOption {
  id: string;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
}

interface CategoryOption {
  id: string;
  title: string;
  oromoTitle?: string | null;
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

  // Bulk Selection State
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  const toggleSelectTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (selectedTrackIds.size === tracks.length && tracks.length > 0) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(tracks.map((t) => t.id)));
    }
  };

  const executeBulkAction = async (action: 'publish' | 'unpublish' | 'archive' | 'restore') => {
    if (selectedTrackIds.size === 0) return;
    setIsBulkProcessing(true);
    setBulkFeedback(null);

    try {
      const res = await fetch('/api/admin/tracks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackIds: Array.from(selectedTrackIds),
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process bulk operation');
      }

      setBulkFeedback(data.message || `Successfully executed ${action} on ${selectedTrackIds.size} tracks`);
      setSelectedTrackIds(new Set());
      await fetchTracks();
      setTimeout(() => setBulkFeedback(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

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
  }, [
    page,
    limit,
    debouncedSearch,
    selectedModule,
    selectedCategory,
    statusFilter,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // Filtered categories according to selected module
  const availableCategories = selectedModule
    ? categories.filter((c) => c.moduleId === selectedModule)
    : categories;

  const handleTrackUpdated = (updated: AudioTrackItem) => {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Audio Library Management"
        description={`Browse, search, edit metadata, and audit ${totalTracks.toLocaleString()} audio tracks across all 8 curriculum modules.`}
        icon={Music}
        actions={
          <button
            onClick={() => fetchTracks()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            title="Refresh tracks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

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
              placeholder="Search by title, Afaan Oromoo title, track ID, or file name..."
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
                  {m.title} {m.oromoTitle || m.amharicTitle ? `(${m.oromoTitle || m.amharicTitle})` : ''}
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
            <span>
              Showing {tracks.length} of {totalTracks.toLocaleString()} tracks
            </span>
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

      {/* Bulk Feedback Banner */}
      {bulkFeedback && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium animate-in fade-in">
          {bulkFeedback}
        </div>
      )}

      {/* Tracks Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={tracks.length > 0 && selectedTrackIds.size === tracks.length}
                    onChange={toggleSelectAllPage}
                    className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">#</th>
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
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Loading audio recordings...</span>
                  </td>
                </tr>
              ) : tracks.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={FileQuestion}
                      title="No tracks found"
                      description="Try broadening your search or resetting filters."
                    />
                  </td>
                </tr>
              ) : (
                tracks.map((track) => {
                  const isCurrentPlaying = currentTrack?.id === track.id && isPlaying;
                  const isCurrent = currentTrack?.id === track.id;
                  const isSelected = selectedTrackIds.has(track.id);

                  return (
                    <tr
                      key={track.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : isCurrent ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectTrack(track.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Track # */}
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-500">
                        {track.trackNumber}
                      </td>

                      {/* Track Details */}
                      <td className="py-3 px-4 max-w-xs sm:max-w-md">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {track.title}
                        </div>
                        {(track.oromoTitle || track.amharicTitle) && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-sans truncate mt-0.5">
                            {track.oromoTitle || track.amharicTitle}
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
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatBytes(track.fileSize)}
                        </div>
                      </td>

                      {/* Publication Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={track.isPublished ? 'published' : 'draft'} />
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
            Showing{' '}
            <span className="font-semibold">{Math.min(totalTracks, (page - 1) * limit + 1)}</span>{' '}
            to <span className="font-semibold">{Math.min(totalTracks, page * limit)}</span> of{' '}
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

      {/* Floating Bulk Action Bar */}
      {selectedTrackIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-200 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs">
              {selectedTrackIds.size}
            </span>
            <span className="text-xs font-semibold">Tracks Selected</span>
          </div>

          <div className="h-4 w-px bg-slate-700 dark:bg-slate-300" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => executeBulkAction('publish')}
              disabled={isBulkProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              Publish
            </button>
            <button
              onClick={() => executeBulkAction('unpublish')}
              disabled={isBulkProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 dark:bg-slate-200 dark:hover:bg-slate-300 dark:text-slate-800 transition-colors disabled:opacity-50"
            >
              Unpublish
            </button>
            <button
              onClick={() => executeBulkAction('archive')}
              disabled={isBulkProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
            >
              Archive
            </button>
            <button
              onClick={() => executeBulkAction('restore')}
              disabled={isBulkProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              Restore
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 dark:bg-slate-300" />

          <button
            onClick={() => setSelectedTrackIds(new Set())}
            className="text-xs text-slate-400 hover:text-white dark:hover:text-slate-900 transition-colors font-medium"
          >
            Clear
          </button>
        </div>
      )}

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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PdfDocumentModal } from '@/components/pdf/PdfDocumentModal';
import { formatBytes } from '@/lib/serialize';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  Download,
  BookOpen,
  Archive,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface PdfVolumeItem {
  id: string;
  documentId: string;
  volumeNumber: number;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
  storageKey?: string | null;
  remoteUrl?: string | null;
  fileSizeBytes: number;
  pageCount: number;
  isPublished: boolean;
  versionNumber: number;
}

interface PdfDocumentItem {
  id: string;
  documentId: string;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  description?: string | null;
  author?: string | null;
  moduleId: string;
  categoryId?: string | null;
  isPublished: boolean;
  archivedAt?: string | null;
  sortOrder: number;
  createdAt: string;
  module: {
    id: string;
    name?: string;
    title?: string;
    oromoTitle?: string | null;
    amharicTitle?: string | null;
  };
  category?: {
    id: string;
    name?: string;
    title?: string;
    oromoTitle?: string | null;
    amharicTitle?: string | null;
  } | null;
  volumes: PdfVolumeItem[];
}

interface ModuleOption {
  id: string;
  name?: string;
  title?: string;
  categories?: { id: string; name?: string; title?: string }[];
}

export default function PdfManagementPage() {
  const [documents, setDocuments] = useState<PdfDocumentItem[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PdfDocumentItem | null>(null);

  // Preview State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
      }
    } catch (err) {
      console.error('Failed to load modules:', err);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        status: statusFilter,
      });
      if (selectedModule) {
        params.set('moduleId', selectedModule);
      }

      const res = await fetch(`/api/admin/pdf?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDocuments(json.data.documents || []);
          setTotalCount(json.data.pagination?.total || 0);
          setTotalPages(json.data.pagination?.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to load PDF documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, selectedModule, statusFilter]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleToggleArchive = async (doc: PdfDocumentItem) => {
    try {
      const res = await fetch(`/api/admin/pdf/${doc.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  };

  const handlePermanentDelete = async (doc: PdfDocumentItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${doc.title}" and all its volumes? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/pdf/${doc.id}?permanent=true`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  // Metrics
  const totalVolumes = documents.reduce((acc, d) => acc + d.volumes.length, 0);
  const totalPdfBytes = documents.reduce(
    (acc, d) => acc + d.volumes.reduce((vAcc, v) => vAcc + Number(v.fileSizeBytes || 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Kitāb & PDF Document Management"
        description="Manage Islamic texts, scholarly treatises, and multi-volume references attached to curriculum modules."
        badge={`${totalCount} Total Documents`}
        actions={
          <button
            onClick={() => {
              setEditingDoc(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Kitāb PDF</span>
          </button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Total Documents"
          value={totalCount}
          subtext="Canonical Kitāb reference works"
          color="emerald"
        />
        <StatCard
          icon={Layers}
          label="Multi-Volume Parts"
          value={totalVolumes}
          subtext="Distinct volume releases indexed"
          color="blue"
        />
        <StatCard
          icon={FileText}
          label="Total PDF Storage"
          value={formatBytes(totalPdfBytes)}
          subtext="Direct-to-cloud PDF storage usage"
          color="amber"
        />
        <StatCard
          icon={ExternalLink}
          label="Mobile Sync Status"
          value="Integrated"
          subtext="Directly retrievable via mobile API"
          color="teal"
        />
      </div>

      {/* Filters and Search Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, Afaan Oromoo title, author, or document ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200"
            >
              <option value="">All Curriculum Modules</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.title || m.id}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="archived">Archived</option>
            </select>

            <button
              onClick={() => fetchDocuments()}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading Kitāb catalog...</span>
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No PDF documents found"
            description="No Kitāb references match your filter criteria. Create or upload a new PDF document to begin."
            action={
              <button
                onClick={() => {
                  setEditingDoc(null);
                  setIsModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                Upload First Document
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Document / Kitāb</th>
                  <th className="py-3 px-4">Module & Category</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4">Volumes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {documents.map((doc) => {
                  const firstVol = doc.volumes[0];
                  const hasFile = Boolean(firstVol?.remoteUrl);

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 border border-emerald-100 dark:border-emerald-900/40">
                            PDF
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span>{doc.title}</span>
                              {(doc.oromoTitle || doc.amharicTitle) && (
                                <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                                  ({doc.oromoTitle || doc.amharicTitle})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {doc.documentId}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {doc.module?.name || doc.module?.title || doc.moduleId}
                          </span>
                          {doc.category && (
                            <div className="text-[11px] text-slate-400">
                              {doc.category.name || doc.category.title}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {doc.author || <span className="text-slate-300 italic">Unspecified</span>}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {doc.volumes.length === 0 ? (
                            <span className="text-slate-400 text-[11px] italic">No volumes</span>
                          ) : (
                            doc.volumes.map((v) => (
                              <div key={v.id} className="flex items-center gap-2 text-[11px]">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                  Vol {v.volumeNumber}
                                </span>
                                <span className="text-slate-400">
                                  {v.fileSizeBytes > 0 ? formatBytes(Number(v.fileSizeBytes)) : 'Pending'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {doc.archivedAt ? (
                          <StatusBadge status="archived" label="Archived" />
                        ) : doc.isPublished ? (
                          <StatusBadge status="published" label="Published" />
                        ) : (
                          <StatusBadge status="draft" label="Draft" />
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasFile && firstVol?.remoteUrl && (
                            <>
                              <button
                                onClick={() => {
                                  setPreviewPdfUrl(firstVol.remoteUrl || '');
                                  setPreviewTitle(`${doc.title} - ${firstVol.title}`);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Preview PDF"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <a
                                href={firstVol.remoteUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </>
                          )}

                          <button
                            onClick={() => {
                              setEditingDoc(doc);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Metadata"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleArchive(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            title={doc.archivedAt ? 'Restore Document' : 'Archive Document'}
                          >
                            <Archive className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handlePermanentDelete(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Document Create / Edit Modal */}
      <PdfDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDocuments}
        modules={modules}
        documentToEdit={editingDoc}
      />

      {/* PDF In-App Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>{previewTitle}</span>
              </h3>
              <button
                onClick={() => setPreviewPdfUrl(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950">
              <iframe src={previewPdfUrl} className="w-full h-full border-0" title="PDF Document Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

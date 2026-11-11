'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle, Trash2, FolderPlus, Edit3 } from 'lucide-react';

export interface ModuleItem {
  id: string;
  slug: string;
  name: string;
  title?: string | null;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  description?: string | null;
  iconName?: string | null;
  sortOrder: number;
  order?: number | null;
  isActive?: boolean;
  categories?: unknown[];
  _count?: {
    tracks: number;
    pdfDocuments: number;
    categories: number;
  };
}

interface ModuleModalProps {
  module: ModuleItem | null; // null for Create mode, ModuleItem for Edit mode
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (module: ModuleItem) => void;
  onDelete?: (id: string) => void;
}

export function ModuleModal({
  module,
  isOpen,
  onClose,
  onSuccess,
  onDelete,
}: ModuleModalProps) {
  const isEdit = !!module;

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [oromoTitle, setOromoTitle] = useState('');
  const [arabicTitle, setArabicTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (module) {
      setSlug(module.slug || module.id);
      setName(module.name || module.title || '');
      setOromoTitle(module.oromoTitle || module.amharicTitle || '');
      setArabicTitle(module.arabicTitle || '');
      setDescription(module.description || '');
      setSortOrder(module.sortOrder ?? module.order ?? 1);
      setIsActive(module.isActive ?? true);
    } else {
      setSlug('');
      setName('');
      setOromoTitle('');
      setArabicTitle('');
      setDescription('');
      setSortOrder(1);
      setIsActive(true);
    }
    setError(null);
  }, [module, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Module name is required');
      return;
    }

    if (!isEdit && !slug.trim()) {
      setError('Module slug identifier is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEdit ? `/api/admin/modules/${module.id}` : '/api/admin/modules';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = isEdit
        ? {
            name: name.trim(),
            oromoTitle: oromoTitle.trim() || null,
            amharicTitle: oromoTitle.trim() || null,
            arabicTitle: arabicTitle.trim() || null,
            description: description.trim() || null,
            sortOrder: Number(sortOrder),
            isActive,
          }
        : {
            slug: slug.trim().toLowerCase(),
            name: name.trim(),
            oromoTitle: oromoTitle.trim() || null,
            amharicTitle: oromoTitle.trim() || null,
            arabicTitle: arabicTitle.trim() || null,
            description: description.trim() || null,
            sortOrder: Number(sortOrder),
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save module');
      }

      onSuccess(data.module);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!module || !onDelete) return;
    if (!confirm(`Are you sure you want to delete module "${module.name || module.title}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/modules/${module.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete module');
      }

      onDelete(module.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete module');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {isEdit ? (
              <Edit3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <FolderPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isEdit ? 'Edit Curriculum Module' : 'Create New Curriculum Module'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isEdit ? `Module ID: ${module.id}` : 'Primary curriculum collection for darses & Kitābs'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Module Slug (Immutable Key) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. seerah, aqeedah"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <p className="text-[11px] text-slate-400">Lowercase alphanumeric and hyphens only.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              English Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beyquna, Hadith Studies"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Afaan Oromoo Title (Mata Duree Afaan Oromoo)
              </label>
              <input
                type="text"
                value={oromoTitle}
                onChange={(e) => setOromoTitle(e.target.value)}
                placeholder="Fkn: Al-Bayquuniyyaa"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                placeholder="مثال: البيقونية"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Curriculum overview, teacher notes, or study objectives..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Display Order
              </label>
              <input
                type="number"
                min="1"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pt-5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Active</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex items-center gap-1.5 border border-red-200 dark:border-red-900/50 transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete Module</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEdit ? 'Save Changes' : 'Create Module'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


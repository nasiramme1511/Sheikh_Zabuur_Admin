'use client';

import React, { useState } from 'react';
import { X, Save, Loader2, AlertCircle, FolderPlus } from 'lucide-react';
import { CategoryItem } from './CategoryEditModal';

interface ModuleOption {
  id: string;
  title: string;
  name?: string;
  amharicTitle?: string | null;
}

interface CategoryCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: ModuleOption[];
  existingCategories: CategoryItem[];
  defaultModuleId?: string;
  onSuccess: (newCategory: CategoryItem) => void;
}

export function CategoryCreateModal({
  isOpen,
  onClose,
  modules,
  existingCategories,
  defaultModuleId,
  onSuccess,
}: CategoryCreateModalProps) {
  const [moduleId, setModuleId] = useState(defaultModuleId || modules[0]?.id || '');
  const [parentId, setParentId] = useState<string>('');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [amharicTitle, setAmharicTitle] = useState('');
  const [arabicTitle, setArabicTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Potential parent categories within the currently selected module
  const parentOptions = existingCategories.filter(
    (c) => c.moduleId === moduleId && !c.parentId
  );

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generatedSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category title is required');
      return;
    }
    if (!slug.trim()) {
      setError('Category slug identifier is required');
      return;
    }
    if (!moduleId) {
      setError('Please select a curriculum module');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          parentId: parentId || null,
          slug: slug.trim().toLowerCase(),
          name: name.trim(),
          amharicTitle: amharicTitle.trim() || null,
          arabicTitle: arabicTitle.trim() || null,
          description: description.trim() || null,
          sortOrder: Number(order),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create category');
      }

      onSuccess(data.category);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create New Category
              </h2>
              <p className="text-[11px] text-slate-500">
                Organize audio darses and reference Kitābs
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

          {/* Module Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Curriculum Module <span className="text-red-500">*</span>
            </label>
            <select
              value={moduleId}
              onChange={(e) => {
                setModuleId(e.target.value);
                setParentId('');
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title || m.name} ({m.id})
                </option>
              ))}
            </select>
          </div>

          {/* Parent Subcategory Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Parent Category (Optional Nesting)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">None (Top-Level Category)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  Nested under: {p.title} ({p.id})
                </option>
              ))}
            </select>
          </div>

          {/* Category Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Category Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Kitabul Nikah, Lessons Vol. 1"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Category Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. kitabul-nikah"
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <p className="text-[11px] text-slate-400">Unique identifier within this module.</p>
          </div>

          {/* Multilingual Titles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Amharic Title (የአማርኛ ርዕስ)
              </label>
              <input
                type="text"
                value={amharicTitle}
                onChange={(e) => setAmharicTitle(e.target.value)}
                placeholder="ለምሳሌ፡ ኪታቡ ኒካህ"
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
                placeholder="مثال: كتاب النكاح"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Curriculum notes, subcategory contents, or syllabus reference..."
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
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
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
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Create Category</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

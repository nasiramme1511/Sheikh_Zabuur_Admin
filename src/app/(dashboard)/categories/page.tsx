'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CategoryEditModal, CategoryItem } from '@/components/categories/CategoryEditModal';
import { CategoryCreateModal } from '@/components/categories/CategoryCreateModal';
import {
  Tags,
  Search,
  RefreshCw,
  Edit2,
  Music,
  GitFork,
  FileQuestion,
  Loader2,
  X,
  Plus,
} from 'lucide-react';

interface ModuleOption {
  id: string;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'root' | 'sub'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [catRes, modRes] = await Promise.all([
        fetch('/api/admin/categories'),
        fetch('/api/admin/modules'),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }

      if (modRes.ok) {
        const modData = await modRes.json();
        setModules(modData.modules || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCategoryUpdated = (updated: CategoryItem) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  };

  const handleCategoryCreated = (newCat: CategoryItem) => {
    setCategories((prev) => [...prev, newCat]);
  };

  const handleCategoryDeleted = (deletedId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== deletedId));
  };

  // Filter categories
  const filteredCategories = categories.filter((c) => {
    if (selectedModule && c.moduleId !== selectedModule) return false;
    if (typeFilter === 'root' && c.parentId) return false;
    if (typeFilter === 'sub' && !c.parentId) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchOromo = (c.oromoTitle || c.amharicTitle)?.toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q);
      return matchTitle || matchOromo || matchId;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Tags className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Category Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Overview of all 105 catalog categories across the 8 curriculum modules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
          </button>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by category title, Afaan Oromoo name, or ID..."
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

        <div className="w-full md:w-56">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All 8 Modules</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-44">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'root' | 'sub')}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Types</option>
            <option value="root">Root Categories</option>
            <option value="sub">Subcategories Only</option>
          </select>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-4">Identifier / Key</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Loading categories...</span>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FileQuestion className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">No categories found</p>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, idx) => {
                  const isSubcategory = !!cat.parentId;

                  return (
                    <tr
                      key={cat.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isSubcategory ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Index / Order */}
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {cat.order || idx + 1}
                      </td>

                      {/* Title */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isSubcategory && (
                            <GitFork className="w-3.5 h-3.5 text-amber-500 rotate-90 shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {cat.title}
                            </div>
                            {(cat.oromoTitle || cat.amharicTitle) && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans mt-0.5">
                                {cat.oromoTitle || cat.amharicTitle}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {cat.id}
                      </td>

                      {/* Module */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                          {cat.module?.title || cat.moduleId}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        {isSubcategory ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Subcategory ({cat.parentId})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Root Category
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/library?categoryId=${cat.id}`}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="View tracks in library"
                          >
                            <Music className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => setEditingCategory(cat)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Edit category"
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

        {/* Footer info */}
        <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          Showing {filteredCategories.length} of {categories.length} categories
        </div>
      </div>

      {/* Category Edit Modal */}
      <CategoryEditModal
        category={editingCategory}
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        onSuccess={handleCategoryUpdated}
        onDelete={handleCategoryDeleted}
      />

      {/* Category Create Modal */}
      <CategoryCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        modules={modules}
        existingCategories={categories}
        defaultModuleId={selectedModule || modules[0]?.id}
        onSuccess={handleCategoryCreated}
      />
    </div>
  );
}


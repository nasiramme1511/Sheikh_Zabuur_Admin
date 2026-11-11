'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CategoryEditModal, CategoryItem } from '@/components/categories/CategoryEditModal';
import { CategoryCreateModal } from '@/components/categories/CategoryCreateModal';
import { ModuleModal, ModuleItem } from '@/components/modules/ModuleModal';
import {
  FolderTree,
  Music,
  ArrowRight,
  Edit2,
  Loader2,
  RefreshCw,
  GitFork,
  Plus,
  Settings2,
} from 'lucide-react';

interface ModuleData {
  id: string;
  slug: string;
  name: string;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  description?: string | null;
  order: number;
  sortOrder: number;
  isActive: boolean;
  categories: CategoryItem[];
}

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);

  const fetchModules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/modules');
      if (!res.ok) throw new Error('Failed to load modules');
      const data = await res.json();
      const mods: ModuleData[] = (data.modules || []).map((m: ModuleData) => ({
        ...m,
        title: m.title || m.name,
      }));
      setModules(mods);
      if (mods.length > 0 && !selectedModuleId) {
        setSelectedModuleId(mods[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedModuleId]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const activeModule = modules.find((m) => m.id === selectedModuleId) || modules[0];

  const handleCategoryUpdated = (updated: CategoryItem) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== updated.moduleId) return mod;
        return {
          ...mod,
          categories: mod.categories.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
        };
      })
    );
  };

  const handleCategoryCreated = (created: CategoryItem) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== created.moduleId) return mod;
        return {
          ...mod,
          categories: [...mod.categories, created].sort((a, b) => a.order - b.order),
        };
      })
    );
  };

  const handleCategoryDeleted = (deletedId: string) => {
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        categories: mod.categories.filter((c) => c.id !== deletedId),
      }))
    );
  };

  const handleModuleCreated = (newMod: ModuleItem) => {
    const formatted: ModuleData = {
      ...newMod,
      title: newMod.title || newMod.name,
      order: newMod.sortOrder,
      isActive: newMod.isActive ?? true,
      categories: [],
    };
    setModules((prev) => [...prev, formatted]);
    setSelectedModuleId(formatted.id);
  };

  const handleModuleUpdated = (updatedMod: ModuleItem) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === updatedMod.id
          ? {
              ...m,
              name: updatedMod.name,
              title: updatedMod.title || updatedMod.name,
              oromoTitle: updatedMod.oromoTitle,
              amharicTitle: updatedMod.oromoTitle || updatedMod.amharicTitle,
              arabicTitle: updatedMod.arabicTitle,
              description: updatedMod.description,
              sortOrder: updatedMod.sortOrder,
              order: updatedMod.sortOrder,
              isActive: updatedMod.isActive ?? m.isActive,
            }
          : m
      )
    );
  };

  const handleModuleDeleted = (deletedId: string) => {
    setModules((prev) => prev.filter((m) => m.id !== deletedId));
    if (selectedModuleId === deletedId && modules.length > 1) {
      const remaining = modules.filter((m) => m.id !== deletedId);
      setSelectedModuleId(remaining[0]?.id || '');
    }
  };

  const totalCatalogTracks = modules.reduce(
    (acc, m) => acc + m.categories.reduce((cAcc, c) => cAcc + (c.trackCount || 0), 0),
    0
  );
  const totalCategories = modules.reduce((acc, m) => acc + m.categories.length, 0);

  const allCategoriesForModule = modules.flatMap((m) => m.categories);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Curriculum Modules & Category Hierarchy
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse and manage all core Islamic curricula, {totalCategories} categories, {totalCatalogTracks.toLocaleString()} recordings, and parent-child hierarchies.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateModuleOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Module</span>
          </button>

          <button
            onClick={fetchModules}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Module Cards Grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
          Curriculum Modules ({modules.length})
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <span>Loading modules...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((m) => {
              const isSelected = m.id === activeModule?.id;
              const moduleTracks = m.categories.reduce((acc, c) => acc + (c.trackCount || 0), 0);

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedModuleId(m.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Module #{m.order || m.sortOrder}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {moduleTracks} tracks
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                      {m.title || m.name}
                    </h3>
                    {(m.oromoTitle || m.amharicTitle) && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-sans mt-0.5 line-clamp-1">
                        {m.oromoTitle || m.amharicTitle}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{m.categories.length} categories</span>
                    <Link
                      href={`/library?moduleId=${m.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <span>Tracks</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Module Category Explorer */}
      {activeModule && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Module Banner */}
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {activeModule.id}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeModule.title || activeModule.name}
                </h2>
                <button
                  onClick={() => setEditingModule(activeModule as unknown as ModuleItem)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Configure Module"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
              {(activeModule.oromoTitle || activeModule.amharicTitle) && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-sans mt-0.5">
                  {activeModule.oromoTitle || activeModule.amharicTitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsCreateCategoryOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>

              <Link
                href={`/library?moduleId=${activeModule.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm transition-colors"
              >
                <Music className="w-3.5 h-3.5 text-emerald-600" />
                <span>View Module Tracks</span>
              </Link>
            </div>
          </div>

          {/* Categories Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">Order</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Identifier / Key</th>
                  <th className="py-3 px-4">Structure</th>
                  <th className="py-3 px-4">Track Count</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {activeModule.categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No categories found in this module.
                    </td>
                  </tr>
                ) : (
                  activeModule.categories.map((cat) => {
                    const isSubcategory = !!cat.parentId;

                    return (
                      <tr
                        key={cat.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          isSubcategory ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                        }`}
                      >
                        {/* Order */}
                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {cat.order}
                        </td>

                        {/* Title & Afaan Oromoo */}
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
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {cat.id}
                        </td>

                        {/* Structure */}
                        <td className="py-3 px-4">
                          {isSubcategory ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                              Subcategory
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Root Category
                            </span>
                          )}
                        </td>

                        {/* Track Count */}
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                          {cat.trackCount ?? 0} tracks
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/library?moduleId=${activeModule.id}&categoryId=${cat.id}`}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Filter tracks in library"
                            >
                              <Music className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              onClick={() =>
                                setEditingCategory({
                                  ...cat,
                                  moduleId: activeModule.id,
                                })
                              }
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
        </div>
      )}

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
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        modules={modules}
        existingCategories={allCategoriesForModule}
        defaultModuleId={activeModule?.id}
        onSuccess={handleCategoryCreated}
      />

      {/* Module Create/Edit Modal */}
      <ModuleModal
        module={editingModule}
        isOpen={isCreateModuleOpen || !!editingModule}
        onClose={() => {
          setIsCreateModuleOpen(false);
          setEditingModule(null);
        }}
        onSuccess={(mod) => {
          if (editingModule) {
            handleModuleUpdated(mod);
          } else {
            handleModuleCreated(mod);
          }
        }}
        onDelete={handleModuleDeleted}
      />
    </div>
  );
}

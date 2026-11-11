'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, UploadCloud, BookOpen } from 'lucide-react';

interface ModuleOption {
  id: string;
  name?: string;
  title?: string;
  categories?: { id: string; name?: string; title?: string }[];
}

interface PdfDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  modules: ModuleOption[];
  documentToEdit?: {
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
    sortOrder: number;
  } | null;
}

export function PdfDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  modules,
  documentToEdit,
}: PdfDocumentModalProps) {
  const isEditing = Boolean(documentToEdit);

  const [documentId, setDocumentId] = useState(documentToEdit?.documentId || '');
  const [isCustomDocumentId, setIsCustomDocumentId] = useState(false);
  const [moduleId, setModuleId] = useState(documentToEdit?.moduleId || (modules[0]?.id || ''));
  const [categoryId, setCategoryId] = useState(documentToEdit?.categoryId || '');
  const [title, setTitle] = useState(documentToEdit?.title || '');
  const [oromoTitle, setOromoTitle] = useState(documentToEdit?.oromoTitle || documentToEdit?.amharicTitle || '');
  const [arabicTitle, setArabicTitle] = useState(documentToEdit?.arabicTitle || '');
  const [description, setDescription] = useState(documentToEdit?.description || '');
  const [author, setAuthor] = useState(documentToEdit?.author || '');
  const [isPublished, setIsPublished] = useState(documentToEdit ? documentToEdit.isPublished : true);
  const [sortOrder, setSortOrder] = useState(documentToEdit ? documentToEdit.sortOrder : 0);

  // File upload state for initial volume
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [volTitle, setVolTitle] = useState('Volume 1');
  const [volNumber, setVolNumber] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state when modal opens or documentToEdit/modules change
  useEffect(() => {
    if (isOpen) {
      if (documentToEdit) {
        setDocumentId(documentToEdit.documentId);
        setIsCustomDocumentId(true);
        setModuleId(documentToEdit.moduleId);
        setCategoryId(documentToEdit.categoryId || '');
        setTitle(documentToEdit.title);
        setOromoTitle(documentToEdit.oromoTitle || documentToEdit.amharicTitle || '');
        setArabicTitle(documentToEdit.arabicTitle || '');
        setDescription(documentToEdit.description || '');
        setAuthor(documentToEdit.author || '');
        setIsPublished(documentToEdit.isPublished);
        setSortOrder(documentToEdit.sortOrder);
      } else {
        setDocumentId('');
        setIsCustomDocumentId(false);
        setModuleId(modules[0]?.id || '');
        setCategoryId('');
        setTitle('');
        setOromoTitle('');
        setArabicTitle('');
        setDescription('');
        setAuthor('');
        setIsPublished(true);
        setSortOrder(0);
        setSelectedFile(null);
        setVolTitle('Volume 1');
        setVolNumber(1);
      }
      setErrorMsg('');
      setUploadProgress(0);
    }
  }, [isOpen, documentToEdit, modules]);

  // Keep moduleId valid if modules array loads late
  useEffect(() => {
    if (!moduleId && modules.length > 0) {
      setModuleId(modules[0].id);
    }
  }, [modules, moduleId]);

  if (!isOpen) return null;

  const currentModule = modules.find((m) => m.id === moduleId);
  const availableCategories = currentModule?.categories || [];

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditing && !isCustomDocumentId) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setDocumentId(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const targetModuleId = moduleId || modules[0]?.id;
      if (!targetModuleId) {
        throw new Error('Please select a curriculum module.');
      }

      const finalDocumentId = (
        documentId.trim() ||
        title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
        `pdf-${Date.now()}`
      );

      if (isEditing && documentToEdit) {
        // Edit document metadata
        const res = await fetch(`/api/admin/pdf/${documentToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            oromoTitle: oromoTitle || null,
            amharicTitle: oromoTitle || null,
            arabicTitle: arabicTitle || null,
            description: description || null,
            author: author || null,
            moduleId: targetModuleId,
            categoryId: categoryId || null,
            isPublished,
            sortOrder: Number(sortOrder),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update PDF document');
        }

        onSuccess();
        onClose();
      } else {
        // Create new document with initial volume upload
        let uploadedStorageKey: string | null = null;
        let uploadedRemoteUrl: string | null = null;
        let fileSizeBytes = 0;

        if (selectedFile) {
          const effectiveContentType =
            selectedFile.type && selectedFile.type !== 'application/octet-stream'
              ? selectedFile.type
              : 'application/pdf';

          // 1. Presign
          const presignRes = await fetch('/api/admin/pdf/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: selectedFile.name,
              contentType: effectiveContentType,
              fileSize: selectedFile.size,
              moduleId: targetModuleId,
              documentId: finalDocumentId,
              volumeNumber: Number(volNumber) || 1,
            }),
          });

          if (!presignRes.ok) {
            const err = await presignRes.json();
            let msg = err.error || 'Failed to obtain presigned upload URL';
            if (err.details && typeof err.details === 'object') {
              const detailsObj = err.details as Record<string, { _errors?: string[] }>;
              const fieldErrors = Object.entries(detailsObj)
                .filter(([k]) => k !== '_errors')
                .map(([field, val]) => `${field}: ${(val?._errors || []).join(', ')}`)
                .filter(Boolean);
              if (fieldErrors.length > 0) {
                msg = `Validation failed: ${fieldErrors.join('; ')}`;
              }
            }
            throw new Error(msg);
          }

          const presignData = await presignRes.json();

          // 2. Direct upload
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', presignData.uploadUrl);
            xhr.setRequestHeader('Content-Type', effectiveContentType);

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                uploadedStorageKey = presignData.storageKey;
                uploadedRemoteUrl = presignData.remoteUrl;
                fileSizeBytes = selectedFile.size;
                resolve();
              } else {
                reject(new Error(`Upload failed with HTTP status ${xhr.status}`));
              }
            };

            xhr.onerror = () => reject(new Error('Network error during PDF upload'));
            xhr.send(selectedFile);
          });
        }

        // 3. Create document record
        const createRes = await fetch('/api/admin/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: finalDocumentId,
            moduleId: targetModuleId,
            categoryId: categoryId || null,
            title,
            oromoTitle: oromoTitle || null,
            amharicTitle: oromoTitle || null,
            arabicTitle: arabicTitle || null,
            description: description || null,
            author: author || null,
            isPublished,
            sortOrder: Number(sortOrder),
            initialVolume: uploadedStorageKey
              ? {
                  volumeNumber: Number(volNumber) || 1,
                  title: volTitle,
                  oromoTitle: oromoTitle || null,
                  amharicTitle: oromoTitle || null,
                  storageKey: uploadedStorageKey,
                  remoteUrl: uploadedRemoteUrl,
                  fileSizeBytes,
                  pageCount: 0,
                  isPublished,
                }
              : undefined,
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          let msg = err.error || 'Failed to register PDF document';
          if (err.details && typeof err.details === 'object') {
            const detailsObj = err.details as Record<string, { _errors?: string[] }>;
            const fieldErrors = Object.entries(detailsObj)
              .filter(([k]) => k !== '_errors')
              .map(([field, val]) => `${field}: ${(val?._errors || []).join(', ')}`)
              .filter(Boolean);
            if (fieldErrors.length > 0) {
              msg = `Validation failed: ${fieldErrors.join('; ')}`;
            }
          }
          throw new Error(msg);
        }

        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Edit Kitāb PDF Document' : 'Upload New Kitāb PDF Document'}
              </h3>
              <p className="text-xs text-slate-500">
                Associate Islamic texts and multi-volume references with curriculum modules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Document Identifier *
              </label>
              <input
                type="text"
                disabled={isEditing}
                required
                placeholder="e.g. usul-salasa-kitab"
                value={documentId}
                onChange={(e) => {
                  setIsCustomDocumentId(true);
                  setDocumentId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Module *
              </label>
              <select
                value={moduleId}
                onChange={(e) => {
                  setModuleId(e.target.value);
                  setCategoryId('');
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.title || m.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Category (Optional)
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- General / Root Module --</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.title || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Author / Scholar
              </label>
              <input
                type="text"
                placeholder="e.g. Sheikh Muhammad ibn Abdilwahhab"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Display Order
              </label>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Title (English / Transliterated) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Al-Usul Al-Thalatha"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Afaan Oromoo Title (Mata Duree Afaan Oromoo)
              </label>
              <input
                type="text"
                placeholder="e.g. Usuula Salfaan"
                value={oromoTitle}
                onChange={(e) => setOromoTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Arabic Title (العنوان بالعربية)
              </label>
              <input
                type="text"
                dir="rtl"
                placeholder="e.g. الأصول الثلاثة"
                value={arabicTitle}
                onChange={(e) => setArabicTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-arabic"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Kitāb overview and study syllabus..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {!isEditing && (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Initial Volume PDF File (Optional)</span>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                className="text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-300"
              />
              {selectedFile && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Volume Title</label>
                    <input
                      type="text"
                      value={volTitle}
                      onChange={(e) => setVolTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Volume Number</label>
                    <input
                      type="number"
                      min={1}
                      value={volNumber}
                      onChange={(e) => setVolNumber(parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Uploading: {uploadProgress}%</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Published (Ready for compilation into mobile catalog)</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? 'Save Changes' : 'Create & Upload PDF'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

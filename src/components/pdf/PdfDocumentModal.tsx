'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, UploadCloud, BookOpen, AlertCircle } from 'lucide-react';
import {
  MAX_PDF_SIZE_BYTES,
  MIN_PDF_SIZE_BYTES,
  DEFAULT_UPLOAD_CONCURRENCY,
} from '@/lib/pdf-upload-policy';

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Multipart upload cancellation & reference tracking
  const activeXhrsRef = useRef<Map<number, XMLHttpRequest>>(new Map());
  const abortUploadSessionRef = useRef<{ uploadId: string; uploadSessionToken: string } | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Cleanup helper to abort any pending XHRs and R2 multipart upload session
  const cleanupActiveUpload = useCallback(async () => {
    isCancelledRef.current = true;

    // 1. Abort all active client-side XHR requests
    activeXhrsRef.current.forEach((xhr) => {
      try {
        xhr.abort();
      } catch {
        // Ignore already completed / aborted XHRs
      }
    });
    activeXhrsRef.current.clear();

    // 2. Call server-side multipart abort endpoint if session exists
    const session = abortUploadSessionRef.current;
    if (session) {
      abortUploadSessionRef.current = null;
      try {
        await fetch('/api/admin/pdf/multipart/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId: session.uploadId,
            uploadSessionToken: session.uploadSessionToken,
          }),
        });
      } catch (err) {
        console.warn('[PDF Upload] Failed to notify abort endpoint:', err);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupActiveUpload();
    };
  }, [cleanupActiveUpload]);

  // Sync state when modal opens or documentToEdit/modules change
  useEffect(() => {
    if (isOpen) {
      isCancelledRef.current = false;
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
      setUploadStatusText('');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_PDF_SIZE_BYTES) {
        setErrorMsg(
          `Selected file exceeds the maximum 500 MiB limit (size: ${formatBytes(file.size)}). Please choose a file under 500 MiB.`
        );
        setSelectedFile(null);
        e.target.value = '';
        return;
      }
      if (file.size < MIN_PDF_SIZE_BYTES) {
        setErrorMsg('Selected PDF file is empty (0 bytes).');
        setSelectedFile(null);
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleCancelClick = async () => {
    if (isSubmitting) {
      await cleanupActiveUpload();
      setIsSubmitting(false);
      setUploadStatusText('Upload cancelled.');
    }
    onClose();
  };

  /**
   * Uploads an individual chunk to a presigned URL using XMLHttpRequest,
   * tracking progress and extracting the server's ETag response header.
   */
  const uploadPartWithRetry = async (
    uploadId: string,
    uploadSessionToken: string,
    partNumber: number,
    chunk: Blob,
    onPartProgress: (loaded: number) => void,
    maxRetries = 3
  ): Promise<string> => {
    let attempt = 0;

    while (attempt < maxRetries) {
      if (isCancelledRef.current) {
        throw new Error('Upload cancelled by user.');
      }

      attempt++;
      try {
        // 1. Request presigned URL for this part
        const partRes = await fetch('/api/admin/pdf/multipart/part', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId,
            uploadSessionToken,
            partNumber,
          }),
        });

        if (!partRes.ok) {
          const err = await partRes.json().catch(() => ({}));
          throw new Error(err.error || `Failed to get presigned URL for part ${partNumber}`);
        }

        const { uploadUrl } = await partRes.json();

        // 2. Upload chunk via XMLHttpRequest
        const eTag = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeXhrsRef.current.set(partNumber, xhr);

          xhr.open('PUT', uploadUrl);

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              onPartProgress(evt.loaded);
            }
          };

          xhr.onload = () => {
            activeXhrsRef.current.delete(partNumber);
            if (xhr.status >= 200 && xhr.status < 300) {
              // ETag header can be lowercase or uppercase
              const rawEtag =
                xhr.getResponseHeader('ETag') ||
                xhr.getResponseHeader('etag') ||
                `"part-${partNumber}-${Date.now()}"`;
              resolve(rawEtag);
            } else {
              reject(new Error(`Part ${partNumber} upload failed with HTTP status ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            activeXhrsRef.current.delete(partNumber);
            reject(new Error(`Network error during upload of part ${partNumber}`));
          };

          xhr.onabort = () => {
            activeXhrsRef.current.delete(partNumber);
            reject(new Error('Upload aborted.'));
          };

          xhr.send(chunk);
        });

        return eTag;
      } catch (err: unknown) {
        if (isCancelledRef.current) {
          throw new Error('Upload cancelled by user.');
        }

        const errMsg = err instanceof Error ? err.message : 'Network error';
        console.warn(`[PDF Part Upload] Part ${partNumber} failed on attempt ${attempt}:`, err);

        if (attempt >= maxRetries) {
          throw new Error(`Part ${partNumber} failed after ${maxRetries} attempts: ${errMsg}`);
        }

        // Exponential backoff
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }

    throw new Error(`Part ${partNumber} failed to upload.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setUploadStatusText('');
    setIsSubmitting(true);
    isCancelledRef.current = false;

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
        // Create new document with multipart volume upload
        let uploadedStorageKey: string | null = null;
        let uploadedRemoteUrl: string | null = null;
        let fileSizeBytes = 0;

        if (selectedFile) {
          const effectiveContentType =
            selectedFile.type && selectedFile.type !== 'application/octet-stream'
              ? selectedFile.type
              : 'application/pdf';

          setUploadStatusText('Initializing multipart upload in cloud storage...');

          // 1. Initialize multipart upload
          const initRes = await fetch('/api/admin/pdf/multipart/init', {
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

          if (!initRes.ok) {
            const err = await initRes.json();
            throw new Error(err.error || 'Failed to initialize multipart cloud upload');
          }

          const initData = await initRes.json();
          const { uploadId, uploadSessionToken, partSize, totalParts } = initData;

          // Track upload session for abort cleanup if cancelled
          abortUploadSessionRef.current = { uploadId, uploadSessionToken };

          // 2. Upload chunks in parallel with controlled concurrency
          const partsResult: { partNumber: number; eTag: string }[] = [];
          const partProgressBytes: number[] = new Array(totalParts).fill(0);

          const updateOverallProgress = () => {
            const totalUploaded = partProgressBytes.reduce((sum, bytes) => sum + bytes, 0);
            const percent = Math.min(99, Math.round((totalUploaded / selectedFile.size) * 100));
            setUploadProgress(percent);
            setUploadStatusText(
              `Uploading parts (${formatBytes(totalUploaded)} / ${formatBytes(selectedFile.size)}) — ${percent}%`
            );
          };

          // Work queue for concurrency
          const queue: number[] = Array.from({ length: totalParts }, (_, i) => i + 1);

          const worker = async () => {
            while (queue.length > 0) {
              if (isCancelledRef.current) break;
              const partNum = queue.shift()!;
              const start = (partNum - 1) * partSize;
              const end = Math.min(start + partSize, selectedFile.size);
              const chunk = selectedFile.slice(start, end);

              const eTag = await uploadPartWithRetry(
                uploadId,
                uploadSessionToken,
                partNum,
                chunk,
                (loaded) => {
                  partProgressBytes[partNum - 1] = loaded;
                  updateOverallProgress();
                }
              );

              partsResult.push({ partNumber: partNum, eTag });
            }
          };

          // Run workers with concurrency limit (e.g. 3)
          const workers = Array.from(
            { length: Math.min(DEFAULT_UPLOAD_CONCURRENCY, totalParts) },
            () => worker()
          );

          await Promise.all(workers);

          if (isCancelledRef.current) {
            throw new Error('Upload cancelled by user.');
          }

          // 3. Complete multipart upload
          setUploadStatusText('Verifying uploaded parts and finalizing cloud storage...');
          setUploadProgress(99);

          const completeRes = await fetch('/api/admin/pdf/multipart/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploadId,
              uploadSessionToken,
              parts: partsResult,
            }),
          });

          if (!completeRes.ok) {
            const err = await completeRes.json();
            throw new Error(err.error || 'Failed to complete multipart upload');
          }

          const completeData = await completeRes.json();
          uploadedStorageKey = completeData.storageKey;
          uploadedRemoteUrl = completeData.remoteUrl;
          fileSizeBytes = completeData.fileSizeBytes || selectedFile.size;
          abortUploadSessionRef.current = null; // Successfully completed, no need to abort
        }

        // 4. Create document record in database
        setUploadStatusText('Registering PDF Kitāb in curriculum library...');
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

        setUploadProgress(100);
        setUploadStatusText('Upload and registration complete!');
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred during PDF upload');
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
                Supports large texts up to 500 MiB with multipart cloud upload.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelClick}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Document Identifier *
              </label>
              <input
                type="text"
                disabled={isEditing || isSubmitting}
                required
                placeholder="e.g. tafseer-kitab"
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
                disabled={isSubmitting}
                value={moduleId}
                onChange={(e) => {
                  setModuleId(e.target.value);
                  setCategoryId('');
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
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
                disabled={isSubmitting}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
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
                disabled={isSubmitting}
                placeholder="e.g. Sheikh Muhammad Zabuur"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Display Order
              </label>
              <input
                type="number"
                min="0"
                disabled={isSubmitting}
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
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
              disabled={isSubmitting}
              placeholder="e.g. Tafseer Al-Qur'an Al-Kareem"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Afaan Oromoo Title (Mata Duree Afaan Oromoo)
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                placeholder="e.g. Tafsiira Qur'aanaa"
                value={oromoTitle}
                onChange={(e) => setOromoTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Arabic Title (العنوان بالعربية)
              </label>
              <input
                type="text"
                dir="rtl"
                disabled={isSubmitting}
                placeholder="e.g. تفسير القرآن الكريم"
                value={arabicTitle}
                onChange={(e) => setArabicTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-arabic disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              placeholder="Kitāb overview and study syllabus..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
            />
          </div>

          {!isEditing && (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Initial Volume PDF File (Up to 500 MiB)</span>
                </div>
                {selectedFile && (
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatBytes(selectedFile.size)}
                  </span>
                )}
              </div>
              <input
                type="file"
                accept="application/pdf"
                disabled={isSubmitting}
                onChange={handleFileChange}
                className="text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-300 disabled:opacity-50"
              />
              {selectedFile && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Volume Title</label>
                    <input
                      type="text"
                      disabled={isSubmitting}
                      value={volTitle}
                      onChange={(e) => setVolTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Volume Number</label>
                    <input
                      type="number"
                      min={1}
                      disabled={isSubmitting}
                      value={volNumber}
                      onChange={(e) => setVolNumber(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              {/* Progress & Status Indicator */}
              {isSubmitting && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {uploadStatusText || 'Uploading...'}
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                disabled={isSubmitting}
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-60"
              />
              <span>Published (Ready for compilation into mobile catalog)</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              {isSubmitting && (
                <button
                  type="button"
                  onClick={handleCancelClick}
                  className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                >
                  Cancel Upload
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isSubmitting
                    ? 'Uploading...'
                    : isEditing
                    ? 'Save Changes'
                    : 'Create & Upload PDF'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

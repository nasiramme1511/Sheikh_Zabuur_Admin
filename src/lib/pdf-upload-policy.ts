/**
 * Sheikh Zabuur Admin Platform — Centralized PDF Upload Policy
 *
 * Single source of truth for PDF upload constraints across frontend, API,
 * storage, and validation layers.
 */

/**
 * Maximum PDF file size: 500 MiB (524,288,000 bytes)
 */
export const MAX_PDF_SIZE_BYTES = 500 * 1024 * 1024; // 524,288,000 bytes

/**
 * Minimum PDF file size: 1 byte
 */
export const MIN_PDF_SIZE_BYTES = 1;

/**
 * Multipart chunk size: 16 MiB (16,777,216 bytes)
 * S3 requirement: Each part must be at least 5 MiB (except the last part).
 * 16 MiB chunks ensure a 500 MiB file is split into 32 parts, well below
 * the 10,000 part S3 limit.
 */
export const MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024; // 16,777,216 bytes

/**
 * Maximum number of parts allowed per multipart upload
 */
export const MAX_MULTIPART_PARTS = 10_000;

/**
 * Maximum upload concurrency for client-side parallel part uploads
 */
export const DEFAULT_UPLOAD_CONCURRENCY = 3;

/**
 * Presigned part URL expiration in seconds (1 hour)
 */
export const PRESIGNED_PART_EXPIRATION_SECONDS = 3600;

/**
 * Upload session token expiration in seconds (24 hours)
 */
export const UPLOAD_SESSION_EXPIRATION_SECONDS = 24 * 3600;

/**
 * Allowed MIME types for PDF documents
 */
export const ALLOWED_PDF_MIME_TYPES = [
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'application/octet-stream',
] as const;

/**
 * Sanitizes PDF filename to prevent path traversal and unsafe characters.
 * Supports Unicode letters and digits while stripping path separators and special characters.
 */
export function sanitizePdfFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'document.pdf';
  return base
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}.-]+/gu, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

/**
 * Validates PDF metadata before initiating or presigning uploads.
 */
export function validatePdfUploadMetadata(params: {
  filename: string;
  contentType: string;
  fileSize: number;
}): { valid: boolean; error?: string } {
  const { filename, contentType, fileSize } = params;

  if (!filename || typeof filename !== 'string' || !filename.trim()) {
    return { valid: false, error: 'A valid filename is required.' };
  }

  // Reject directory traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Filename contains invalid or unsafe path characters.' };
  }

  if (typeof fileSize !== 'number' || isNaN(fileSize)) {
    return { valid: false, error: 'File size must be a valid number.' };
  }

  if (fileSize < MIN_PDF_SIZE_BYTES) {
    return { valid: false, error: 'PDF file cannot be empty (0 bytes).' };
  }

  if (fileSize > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      error: `PDF document exceeds maximum size limit of 500 MiB (actual: ${(fileSize / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  const normalizedContentType = (contentType || '').toLowerCase().trim();
  const hasPdfExtension = filename.toLowerCase().endsWith('.pdf');

  if (normalizedContentType === 'application/octet-stream') {
    if (!hasPdfExtension) {
      return {
        valid: false,
        error: 'Generic binary stream requires a .pdf file extension.',
      };
    }
  } else {
    const isStandardPdfMime = [
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'applications/vnd.pdf',
      'text/pdf',
    ].includes(normalizedContentType);

    if (!isStandardPdfMime && !hasPdfExtension) {
      return {
        valid: false,
        error: `Unsupported format "${contentType}". Only PDF documents are allowed.`,
      };
    }
  }

  return { valid: true };
}

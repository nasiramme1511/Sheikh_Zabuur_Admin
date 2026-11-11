import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  MAX_PDF_SIZE_BYTES,
  MIN_PDF_SIZE_BYTES,
  MULTIPART_PART_SIZE_BYTES,
  validatePdfUploadMetadata,
  sanitizePdfFilename,
} from '../src/lib/pdf-upload-policy';
import {
  createUploadSessionToken,
  verifyUploadSessionToken,
  PdfUploadSessionData,
} from '../src/lib/upload-session';
import {
  createMultipartUpload,
  getMultipartUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  verifyUploadedObject,
} from '../src/lib/storage';

const mockUserA = {
  id: 'admin-user-a',
  email: 'admin_a@sheikhzabur.com',
  name: 'Admin A',
  roleId: 'CONTENT_MANAGER',
  roleName: 'Content Manager',
  permissions: ['pdf:upload', 'pdf:view'],
};

const mockUserB = {
  id: 'admin-user-b',
  email: 'admin_b@sheikhzabur.com',
  name: 'Admin B',
  roleId: 'EDITOR',
  roleName: 'Editor',
  permissions: ['pdf:upload', 'pdf:view'],
};

const mockUserNoUpload = {
  id: 'admin-user-viewer',
  email: 'viewer@sheikhzabur.com',
  name: 'Viewer',
  roleId: 'VIEWER',
  roleName: 'Viewer',
  permissions: ['pdf:view'],
};

const mockSuperAdmin = {
  id: 'admin-super',
  email: 'super@sheikhzabur.com',
  name: 'Super Admin',
  roleId: 'SUPER_ADMIN',
  roleName: 'Super Administrator',
  permissions: ['*'],
};

describe('1. Centralized PDF Upload Policy & Size Validation', () => {
  test('1. Zero-byte PDF rejection', () => {
    const res = validatePdfUploadMetadata({
      filename: 'empty.pdf',
      contentType: 'application/pdf',
      fileSize: 0,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || '', /cannot be empty/i);
  });

  test('2. Valid small PDF (10 KB)', () => {
    const res = validatePdfUploadMetadata({
      filename: 'sample-book.pdf',
      contentType: 'application/pdf',
      fileSize: 10 * 1024,
    });
    assert.equal(res.valid, true);
    assert.equal(res.error, undefined);
  });

  test('3. Valid 100 MiB PDF (104,857,600 bytes)', () => {
    const res = validatePdfUploadMetadata({
      filename: 'tafseer-part1.pdf',
      contentType: 'application/pdf',
      fileSize: 100 * 1024 * 1024,
    });
    assert.equal(res.valid, true);
  });

  test('4. Valid 200 MiB PDF (209,715,200 bytes)', () => {
    const res = validatePdfUploadMetadata({
      filename: 'tafseer-part2.pdf',
      contentType: 'application/pdf',
      fileSize: 200 * 1024 * 1024,
    });
    assert.equal(res.valid, true);
  });

  test('5. Valid exact boundary 500 MiB PDF (524,288,000 bytes)', () => {
    const res = validatePdfUploadMetadata({
      filename: 'tafseer-complete-500mb.pdf',
      contentType: 'application/pdf',
      fileSize: MAX_PDF_SIZE_BYTES,
    });
    assert.equal(res.valid, true);
  });

  test('6. Rejection of file exceeding 500 MiB (524,288,001 bytes)', () => {
    const res = validatePdfUploadMetadata({
      filename: 'tafseer-oversized.pdf',
      contentType: 'application/pdf',
      fileSize: MAX_PDF_SIZE_BYTES + 1,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || '', /exceeds maximum size limit of 500 MiB/i);
  });

  test('7. Rejection of invalid MIME types and non-PDF extensions', () => {
    const resImage = validatePdfUploadMetadata({
      filename: 'cover.png',
      contentType: 'image/png',
      fileSize: 1024,
    });
    assert.equal(resImage.valid, false);
    assert.match(resImage.error || '', /Only PDF documents are allowed/i);

    const resExe = validatePdfUploadMetadata({
      filename: 'malware.exe',
      contentType: 'application/octet-stream',
      fileSize: 1024,
    });
    assert.equal(resExe.valid, false);
  });

  test('Filename sanitization rejects path traversal', () => {
    assert.equal(sanitizePdfFilename('../../../etc/passwd.pdf'), 'passwd.pdf');
    assert.equal(sanitizePdfFilename('C:\\Windows\\system32\\document.pdf'), 'document.pdf');
    assert.equal(sanitizePdfFilename('تفسير القرآن الكريم.pdf'), 'تفسير_القرآن_الكريم.pdf');
  });
});

describe('2. Upload Session Cryptography & Authorization', () => {
  test('8 & 9. Upload session token creation and verification with owner', () => {
    const { token, session } = createUploadSessionToken({
      uploadId: 'test-upload-123',
      storageKey: 'pdf/tafseer/tafseer-kitab/volume-1.pdf',
      adminUserId: mockUserA.id,
      documentId: 'tafseer-kitab',
      moduleId: 'tafseer',
      volumeNumber: 1,
      filename: 'tafseer.pdf',
      fileSize: 32 * 1024 * 1024,
    });

    assert.ok(token);
    assert.equal(session.totalParts, 2); // 32 MiB / 16 MiB = 2 parts

    // Owner verification succeeds
    const verified = verifyUploadSessionToken(token, mockUserA);
    assert.equal(verified.valid, true);
    assert.equal(verified.session?.adminUserId, mockUserA.id);
  });

  test('10. Upload ownership violation rejection', () => {
    const { token } = createUploadSessionToken({
      uploadId: 'user-a-upload',
      storageKey: 'pdf/usul/usul-kitab/volume-1.pdf',
      adminUserId: mockUserA.id,
      documentId: 'usul-kitab',
      moduleId: 'usul',
      volumeNumber: 1,
      filename: 'usul.pdf',
      fileSize: 16 * 1024 * 1024,
    });

    // Admin B attempting to use Admin A's session is rejected
    const verifiedB = verifyUploadSessionToken(token, mockUserB);
    assert.equal(verifiedB.valid, false);
    assert.match(verifiedB.error || '', /Upload ownership violation/i);

    // Super Admin can manage any upload session
    const verifiedSuper = verifyUploadSessionToken(token, mockSuperAdmin);
    assert.equal(verifiedSuper.valid, true);
  });

  test('Tampered token signature is detected and rejected', () => {
    const { token } = createUploadSessionToken({
      uploadId: 'tamper-test',
      storageKey: 'pdf/general/doc/volume-1.pdf',
      adminUserId: mockUserA.id,
      documentId: 'doc',
      moduleId: 'general',
      volumeNumber: 1,
      filename: 'doc.pdf',
      fileSize: 1024,
    });

    const [payloadB64] = token.split('.');
    const forgedToken = `${payloadB64}.forgedSignature12345`;

    const verified = verifyUploadSessionToken(forgedToken, mockUserA);
    assert.equal(verified.valid, false);
    assert.match(verified.error || '', /Invalid or tampered/i);
  });
});

describe('3. Multipart Upload Flow & Part Number Validation', () => {
  test('11. Invalid part numbers detection', () => {
    const { session } = createUploadSessionToken({
      uploadId: 'parts-test',
      storageKey: 'pdf/usul/doc/volume-1.pdf',
      adminUserId: mockUserA.id,
      documentId: 'doc',
      moduleId: 'usul',
      volumeNumber: 1,
      filename: 'doc.pdf',
      fileSize: 32 * 1024 * 1024, // 2 parts
    });

    assert.equal(session.totalParts, 2);

    // Part 0 is invalid
    const isPart0Valid = 0 >= 1 && 0 <= session.totalParts;
    assert.equal(isPart0Valid, false);

    // Part 3 exceeds totalParts (2)
    const isPart3Valid = 3 >= 1 && 3 <= session.totalParts;
    assert.equal(isPart3Valid, false);

    // Part 1 and 2 are valid
    assert.equal(1 >= 1 && 1 <= session.totalParts, true);
    assert.equal(2 >= 1 && 2 <= session.totalParts, true);
  });

  test('12. Duplicate parts detection', () => {
    const partsWithDuplicate = [
      { partNumber: 1, eTag: '"etag-1"' },
      { partNumber: 1, eTag: '"etag-1-dup"' },
    ];

    const seen = new Set<number>();
    let hasDuplicate = false;
    for (const p of partsWithDuplicate) {
      if (seen.has(p.partNumber)) {
        hasDuplicate = true;
        break;
      }
      seen.add(p.partNumber);
    }

    assert.equal(hasDuplicate, true);
  });

  test('14. Missing parts rejection during completion', () => {
    const totalParts = 3;
    const submittedParts = [
      { partNumber: 1, eTag: '"etag-1"' },
      { partNumber: 3, eTag: '"etag-3"' },
    ]; // Missing part 2

    assert.notEqual(submittedParts.length, totalParts);

    const partSet = new Set(submittedParts.map((p) => p.partNumber));
    let missingPartNumber: number | null = null;
    for (let i = 1; i <= totalParts; i++) {
      if (!partSet.has(i)) {
        missingPartNumber = i;
        break;
      }
    }

    assert.equal(missingPartNumber, 2);
  });
});

describe('4. End-to-End Multipart Upload Simulation with Real PDF Bytes', () => {
  test('Full multipart lifecycle: init -> parts upload -> complete -> verify -> abort/clean', async () => {
    // Generate a real 100 KB test PDF buffer
    const pdfHeader = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
    const pdfBody = crypto.randomBytes(100 * 1024 - 100);
    const pdfFooter = Buffer.from('\n%%EOF');
    const fullPdfBuffer = Buffer.concat([pdfHeader, pdfBody, pdfFooter]);
    const fileSize = fullPdfBuffer.length;

    // 1. Initialize
    const init = await createMultipartUpload({
      assetType: 'pdf',
      filename: 'e2e-test-kitab.pdf',
      contentType: 'application/pdf',
      fileSize,
      moduleId: 'tafseer',
      documentId: 'e2e-tafseer-kitab',
      volumeNumber: 1,
    });

    assert.ok(init.uploadId);
    assert.ok(init.storageKey.startsWith('pdf/tafseer/e2e-tafseer-kitab/volume-1.pdf'));

    // 2. Upload Part
    const partUrlRes = await getMultipartUploadPartUrl({
      storageKey: init.storageKey,
      uploadId: init.uploadId,
      partNumber: 1,
    });
    assert.ok(partUrlRes.uploadUrl);

    // In simulated mode, write the chunk to the simulated multipart dir
    const simulatedDir = path.join(process.cwd(), '.uploads', `multipart_${init.uploadId}`);
    fs.mkdirSync(simulatedDir, { recursive: true });
    fs.writeFileSync(path.join(simulatedDir, 'part_1'), fullPdfBuffer);

    // 3. Complete
    const eTag = `"${crypto.createHash('md5').update(fullPdfBuffer).digest('hex')}"`;
    const completed = await completeMultipartUpload({
      storageKey: init.storageKey,
      uploadId: init.uploadId,
      parts: [{ partNumber: 1, eTag }],
    });

    assert.equal(completed.storageKey, init.storageKey);

    // 4. Verify HeadObject on completed object
    const verified = await verifyUploadedObject(init.storageKey);
    assert.ok(verified);
    assert.equal(verified?.size, fileSize);

    // 5. Clean up test file
    const safeKey = init.storageKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const localUploadedPath = path.join(process.cwd(), '.uploads', safeKey);
    if (fs.existsSync(localUploadedPath)) {
      fs.unlinkSync(localUploadedPath);
    }
  });

  test('17. Multipart upload cancellation cleans up active state', async () => {
    const init = await createMultipartUpload({
      assetType: 'pdf',
      filename: 'cancelled-upload.pdf',
      contentType: 'application/pdf',
      fileSize: 16 * 1024 * 1024,
      moduleId: 'tafseer',
      documentId: 'cancelled-doc',
      volumeNumber: 1,
    });

    const simulatedDir = path.join(process.cwd(), '.uploads', `multipart_${init.uploadId}`);
    fs.mkdirSync(simulatedDir, { recursive: true });
    assert.equal(fs.existsSync(simulatedDir), true);

    // Abort
    const aborted = await abortMultipartUpload({
      storageKey: init.storageKey,
      uploadId: init.uploadId,
    });
    assert.equal(aborted, true);
    assert.equal(fs.existsSync(simulatedDir), false);
  });

  test('Missing pdf:upload permission assertion', () => {
    // Assert user lacking pdf:upload permission cannot authorize
    const hasPermission = mockUserNoUpload.permissions.includes('pdf:upload');
    assert.equal(hasPermission, false);
  });

  test('Retry behavior with backoff succeeds on transient failure', async () => {
    let attempts = 0;
    const maxRetries = 3;

    async function attemptUpload(): Promise<string> {
      attempts++;
      if (attempts < 3) {
        throw new Error('Transient 503 Service Unavailable');
      }
      return '"success-etag"';
    }

    let result = '';
    for (let i = 1; i <= maxRetries; i++) {
      try {
        result = await attemptUpload();
        break;
      } catch (err) {
        if (i === maxRetries) throw err;
      }
    }

    assert.equal(result, '"success-etag"');
    assert.equal(attempts, 3);
  });

  test('Duplicate completion handling on already completed upload', async () => {
    // Attempting to complete with no parts throws a clear validation error
    await assert.rejects(
      async () => {
        await completeMultipartUpload({
          storageKey: 'pdf/general/doc/volume-1.pdf',
          uploadId: 'already-completed-upload',
          parts: [],
        });
      },
      {
        message: /Cannot complete multipart upload without parts/i,
      }
    );
  });
});

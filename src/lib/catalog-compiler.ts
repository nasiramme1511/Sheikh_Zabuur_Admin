import crypto from 'crypto';
import { prisma } from './prisma';
import { formatBytes, formatDuration } from './serialize';

export interface MobileCategory {
  id: string;
  moduleId: string;
  parentId: string | null;
  title: string;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  description?: string | null;
  trackCount: number;
  order: number;
}

export interface MobileModule {
  id: string;
  title: string;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  description?: string | null;
  order: number;
  submoduleCount: number;
  totalTracks: number;
  categories: MobileCategory[];
}

export interface MobileTrack {
  id: string;
  moduleId: string;
  categoryId: string;
  parentId: string;
  title: string;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  originalFilename?: string | null;
  relativePath?: string | null;
  storageKey?: string | null;
  remoteUrl: string;
  duration: number;
  formattedDuration?: string | null;
  fileSize: number;
  formattedFileSize?: string | null;
  format: string;
  trackNumber: number;
  downloadStatus: string;
  isPlaceholder: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface MobileCatalog {
  metadata: {
    version: string;
    updatedAt: string;
    totalModules: number;
    totalCategories: number;
    totalTracks: number;
    totalSizeBytes: number;
  };
  modules: MobileModule[];
  tracks: MobileTrack[];
}

export interface MobileCatalogVersionManifest {
  version: string;
  updatedAt: string;
  minAppVersion: string;
  totalModules: number;
  totalTracks: number;
  totalSizeBytes: number;
  formattedTotalSize: string;
  checksum: string;
}

export interface CompilationResult {
  catalog: MobileCatalog;
  versionManifest: MobileCatalogVersionManifest;
  catalogJson: string;
  versionManifestJson: string;
  checksumMd5: string;
  checksumSha256: string;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    totalModules: number;
    totalCategories: number;
    totalTracks: number;
    totalSizeBytes: number;
    formattedSize: string;
  };
}

/**
 * Compiles published audio tracks, modules, and categories from PostgreSQL
 * into the exact mobile catalog JSON contracts.
 */
export async function compileCatalog(version: string): Promise<CompilationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Fetch modules, categories, and published tracks
  const [modulesData, tracksData] = await Promise.all([
    prisma.audioModule.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.audioTrack.findMany({
      where: { isPublished: true },
      orderBy: [
        { moduleId: 'asc' },
        { categoryId: 'asc' },
        { trackNumber: 'asc' },
      ],
    }),
  ]);

  if (modulesData.length === 0) {
    errors.push('No active modules found in database.');
  }

  if (tracksData.length === 0) {
    errors.push('No published tracks found in database.');
  }

  // 2. Validate track IDs and references
  const trackIdSet = new Set<string>();
  const categoryIdSet = new Set<string>();
  const moduleIdSet = new Set<string>(modulesData.map((m) => m.id));

  for (const mod of modulesData) {
    for (const cat of mod.categories) {
      categoryIdSet.add(cat.id);
    }
  }

  let totalSizeBytes = 0;

  const tracks: MobileTrack[] = tracksData.map((t) => {
    // Duplicate check
    if (trackIdSet.has(t.id)) {
      errors.push(`Duplicate track identifier detected: ${t.id}`);
    }
    trackIdSet.add(t.id);

    // Foreign reference check
    if (!moduleIdSet.has(t.moduleId)) {
      errors.push(`Track ${t.id} references non-existent module ${t.moduleId}`);
    }
    if (!categoryIdSet.has(t.categoryId)) {
      errors.push(`Track ${t.id} references non-existent category ${t.categoryId}`);
    }

    if (!t.remoteUrl) {
      errors.push(`Track ${t.id} is missing a remoteUrl`);
    }

    const sizeNum = Number(t.fileSize);
    totalSizeBytes += sizeNum;

    return {
      id: t.id,
      moduleId: t.moduleId,
      categoryId: t.categoryId,
      parentId: t.parentId || t.categoryId,
      title: t.title,
      amharicTitle: t.amharicTitle || null,
      arabicTitle: t.arabicTitle || null,
      originalFilename: t.originalFilename || null,
      relativePath: t.relativePath || null,
      storageKey: t.storageKey || null,
      remoteUrl: t.remoteUrl,
      duration: t.duration,
      formattedDuration: t.formattedDuration || formatDuration(t.duration),
      fileSize: sizeNum,
      formattedFileSize: t.formattedFileSize || formatBytes(sizeNum),
      format: t.format || 'mp3',
      trackNumber: t.trackNumber,
      downloadStatus: t.downloadStatus || 'none',
      isPlaceholder: t.isPlaceholder || false,
      metadata: (t.metadata as Record<string, unknown>) || null,
    };
  });

  // Calculate actual counts per module and category from published tracks
  const categoryTrackCountMap = new Map<string, number>();
  const moduleTrackCountMap = new Map<string, number>();

  for (const track of tracks) {
    categoryTrackCountMap.set(
      track.categoryId,
      (categoryTrackCountMap.get(track.categoryId) || 0) + 1
    );
    moduleTrackCountMap.set(
      track.moduleId,
      (moduleTrackCountMap.get(track.moduleId) || 0) + 1
    );
  }

  let totalCategoriesCount = 0;

  const modules: MobileModule[] = modulesData.map((m) => {
    const cats: MobileCategory[] = m.categories.map((c) => {
      totalCategoriesCount++;
      return {
        id: c.id,
        moduleId: c.moduleId,
        parentId: c.parentId || null,
        title: c.title,
        amharicTitle: c.amharicTitle || null,
        arabicTitle: c.arabicTitle || null,
        description: c.description || null,
        trackCount: categoryTrackCountMap.get(c.id) || 0,
        order: c.order,
      };
    });

    return {
      id: m.id,
      title: m.title,
      amharicTitle: m.amharicTitle || null,
      arabicTitle: m.arabicTitle || null,
      description: m.description || null,
      order: m.order,
      submoduleCount: m.submoduleCount,
      totalTracks: moduleTrackCountMap.get(m.id) || 0,
      categories: cats,
    };
  });

  const nowIso = new Date().toISOString();

  const catalog: MobileCatalog = {
    metadata: {
      version,
      updatedAt: nowIso,
      totalModules: modules.length,
      totalCategories: totalCategoriesCount,
      totalTracks: tracks.length,
      totalSizeBytes,
    },
    modules,
    tracks,
  };

  const catalogJson = JSON.stringify(catalog, null, 2);

  // Compute Checksums
  const checksumMd5 = crypto.createHash('md5').update(catalogJson).digest('hex');
  const checksumSha256 = crypto.createHash('sha256').update(catalogJson).digest('hex');

  const versionManifest: MobileCatalogVersionManifest = {
    version,
    updatedAt: nowIso,
    minAppVersion: '1.0.0',
    totalModules: modules.length,
    totalTracks: tracks.length,
    totalSizeBytes,
    formattedTotalSize: formatBytes(totalSizeBytes),
    checksum: checksumMd5,
  };

  const versionManifestJson = JSON.stringify(versionManifest, null, 2);

  // Guard against accidental catalog truncation
  if (tracks.length < 1731) {
    warnings.push(
      `Published tracks count (${tracks.length}) is lower than baseline production count (1,731). Verify draft statuses before releasing.`
    );
  }

  return {
    catalog,
    versionManifest,
    catalogJson,
    versionManifestJson,
    checksumMd5,
    checksumSha256,
    validation: {
      isValid: errors.length === 0,
      errors,
      warnings,
      totalModules: modules.length,
      totalCategories: totalCategoriesCount,
      totalTracks: tracks.length,
      totalSizeBytes,
      formattedSize: formatBytes(totalSizeBytes),
    },
  };
}

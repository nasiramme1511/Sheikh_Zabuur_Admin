import crypto from 'crypto';
import { prisma } from './prisma';
import { formatBytes, formatDuration } from './serialize';
import { getPublicDownloadUrl } from './storage';
import { getServerEnv } from './env';

export interface MobileCategory {
  id: string;
  moduleId: string;
  parentId: string | null;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  description?: string | null;
  trackCount: number;
  order: number;
}

export interface MobileModule {
  id: string;
  title: string;
  oromoTitle?: string | null;
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
  oromoTitle?: string | null;
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

export interface MobilePdfVolume {
  volumeNumber: number;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
  remoteUrl: string;
  downloadUrl: string;
  fileSizeBytes: number;
  formattedFileSize?: string | null;
  mimeType: string;
  pageCount?: number | null;
  sha256?: string | null;
  versionNumber: number;
  storageKey?: string | null;
  isPublished: boolean;
  updatedAt?: string | null;
}

export interface MobilePdfDocument {
  id: string;
  documentId: string;
  moduleId: string;
  categoryId?: string | null;
  title: string;
  oromoTitle?: string | null;
  amharicTitle?: string | null;
  arabicTitle?: string | null;
  description?: string | null;
  author?: string | null;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string;
  volumes: MobilePdfVolume[];
}

export interface MobileBrandingConfig {
  appName: string;
  tagline?: string | null;
  primaryColor: string;
  secondaryColor?: string | null;
  inAppLogoUrl?: string | null;
  logoEmblemUrl?: string | null;
  splashScreenUrl?: string | null;
  loginArtworkUrl?: string | null;
  bannerUrls: string[];
}

export interface MobileCatalog {
  metadata: {
    version: string;
    updatedAt: string;
    totalModules: number;
    totalCategories: number;
    totalTracks: number;
    totalPdfs?: number;
    totalSizeBytes: number;
  };
  modules: MobileModule[];
  tracks: MobileTrack[];
  pdfs?: MobilePdfDocument[];
  branding?: MobileBrandingConfig | null;
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

  // 1. Fetch modules, categories, published tracks, published PDFs, and active branding
  const [modulesData, tracksData, pdfsData, currentBranding, minVersionSetting] = await Promise.all([
    prisma.audioModule.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    prisma.audioTrack.findMany({
      where: { isPublished: true, archivedAt: null },
      orderBy: [{ moduleId: 'asc' }, { categoryId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        category: {
          select: { moduleId: true },
        },
      },
    }),
    prisma.pdfDocument.findMany({
      where: { isPublished: true, archivedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        volumes: {
          where: { isPublished: true, archivedAt: null },
          orderBy: { volumeNumber: 'asc' },
        },
      },
    }),
    prisma.appBranding.findFirst({
      where: { isCurrent: true },
    }),
    prisma.systemSetting.findUnique({
      where: { key: 'min_mobile_version' },
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
    const trackIdentifier = t.trackId || t.id;
    const effectiveModuleId = t.moduleId || t.category?.moduleId || '';
    const trackDuration = t.durationSeconds || t.duration || 0;
    const trackNum = t.trackNumber ?? t.sortOrder ?? 0;
    const trackTitle = t.title || '';

    // Duplicate check
    if (trackIdSet.has(trackIdentifier)) {
      errors.push(`Duplicate track identifier detected: ${trackIdentifier}`);
    }
    trackIdSet.add(trackIdentifier);

    // Foreign reference check
    if (!moduleIdSet.has(effectiveModuleId)) {
      errors.push(`Track ${trackIdentifier} references non-existent module ${effectiveModuleId}`);
    }
    if (!categoryIdSet.has(t.categoryId)) {
      errors.push(`Track ${trackIdentifier} references non-existent category ${t.categoryId}`);
    }

    if (!t.remoteUrl) {
      errors.push(`Track ${trackIdentifier} is missing a remoteUrl`);
    }

    const sizeNum = Number(t.fileSize || 0);
    totalSizeBytes += sizeNum;

    return {
      id: trackIdentifier,
      moduleId: effectiveModuleId,
      categoryId: t.categoryId,
      parentId: t.parentId || t.categoryId,
      title: trackTitle,
      oromoTitle: t.oromoTitle || t.amharicTitle || null,
      amharicTitle: t.amharicTitle || t.oromoTitle || null,
      arabicTitle: t.arabicTitle || null,
      originalFilename: t.originalFilename || null,
      relativePath: t.relativePath || null,
      storageKey: t.storageKey || null,
      remoteUrl: t.remoteUrl || '',
      duration: trackDuration,
      formattedDuration: t.formattedDuration || formatDuration(trackDuration),
      fileSize: sizeNum,
      formattedFileSize: t.formattedFileSize || formatBytes(sizeNum),
      format: t.format || 'mp3',
      trackNumber: trackNum,
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
    moduleTrackCountMap.set(track.moduleId, (moduleTrackCountMap.get(track.moduleId) || 0) + 1);
  }

  let totalCategoriesCount = 0;

  const modules: MobileModule[] = modulesData.map((m) => {
    const cats: MobileCategory[] = m.categories.map((c) => {
      totalCategoriesCount++;
      return {
        id: c.id,
        moduleId: c.moduleId,
        parentId: c.parentId || null,
        title: c.name || c.title || c.id,
        oromoTitle: c.oromoTitle || c.amharicTitle || null,
        amharicTitle: c.amharicTitle || c.oromoTitle || null,
        arabicTitle: c.arabicTitle || null,
        description: c.description || null,
        trackCount: categoryTrackCountMap.get(c.id) || 0,
        order: c.sortOrder ?? c.order ?? 0,
      };
    });

    return {
      id: m.id,
      title: m.name || m.title || m.id,
      oromoTitle: m.oromoTitle || m.amharicTitle || null,
      amharicTitle: m.amharicTitle || m.oromoTitle || null,
      arabicTitle: m.arabicTitle || null,
      description: m.description || null,
      order: m.sortOrder ?? m.order ?? 0,
      submoduleCount: m.submoduleCount ?? cats.length,
      totalTracks: moduleTrackCountMap.get(m.id) || 0,
      categories: cats,
    };
  });

  const nowIso = new Date().toISOString();
  const env = getServerEnv();
  const appUrl = (env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  // Compile Published PDFs with complete mobile-accessible metadata
  const pdfs: MobilePdfDocument[] = pdfsData.map((doc) => ({
    id: doc.id,
    documentId: doc.documentId,
    moduleId: doc.moduleId,
    categoryId: doc.categoryId || null,
    title: doc.title,
    oromoTitle: doc.oromoTitle || doc.amharicTitle || null,
    amharicTitle: doc.amharicTitle || doc.oromoTitle || null,
    arabicTitle: doc.arabicTitle || null,
    description: doc.description || null,
    author: doc.author || null,
    isPublished: doc.isPublished,
    sortOrder: doc.sortOrder,
    updatedAt: doc.updatedAt.toISOString(),
    volumes: doc.volumes.map((vol) => {
      let publicUrl = vol.remoteUrl || '';
      if (!publicUrl || publicUrl.includes('/api/admin/uploads/mock')) {
        if (vol.storageKey) {
          publicUrl = getPublicDownloadUrl(vol.storageKey, `${doc.documentId}-vol${vol.volumeNumber}.pdf`);
        } else {
          publicUrl = `${appUrl}/api/v1/pdf/download?key=${encodeURIComponent(`pdf/${doc.moduleId}/${doc.documentId}/volume-${vol.volumeNumber}.pdf`)}`;
        }
      }

      const sizeNum = Number(vol.fileSizeBytes || 0);

      return {
        volumeNumber: vol.volumeNumber,
        title: vol.title,
        oromoTitle: vol.oromoTitle || vol.amharicTitle || null,
        amharicTitle: vol.amharicTitle || vol.oromoTitle || null,
        remoteUrl: publicUrl,
        downloadUrl: publicUrl,
        fileSizeBytes: sizeNum,
        formattedFileSize: formatBytes(sizeNum),
        mimeType: 'application/pdf',
        pageCount: vol.pageCount || null,
        sha256: vol.sha256 || null,
        versionNumber: vol.versionNumber,
        storageKey: vol.storageKey || null,
        isPublished: vol.isPublished,
        updatedAt: vol.updatedAt.toISOString(),
      };
    }),
  }));

  // Compile Active App Branding
  const branding: MobileBrandingConfig | null = currentBranding
    ? {
        appName: currentBranding.appName,
        tagline: currentBranding.tagline || null,
        primaryColor: currentBranding.primaryColor,
        secondaryColor: currentBranding.secondaryColor || null,
        inAppLogoUrl: currentBranding.inAppLogoUrl || null,
        logoEmblemUrl: currentBranding.logoEmblemUrl || null,
        splashScreenUrl: currentBranding.splashScreenUrl || null,
        loginArtworkUrl: currentBranding.loginArtworkUrl || null,
        bannerUrls: (currentBranding.bannerUrls as string[]) || [],
      }
    : null;

  const catalog: MobileCatalog = {
    metadata: {
      version,
      updatedAt: nowIso,
      totalModules: modules.length,
      totalCategories: totalCategoriesCount,
      totalTracks: tracks.length,
      totalPdfs: pdfs.length,
      totalSizeBytes,
    },
    modules,
    tracks,
    pdfs,
    branding,
  };

  const catalogJson = JSON.stringify(catalog, null, 2);

  // Compute Checksums
  const checksumMd5 = crypto.createHash('md5').update(catalogJson).digest('hex');
  const checksumSha256 = crypto.createHash('sha256').update(catalogJson).digest('hex');

  const versionManifest: MobileCatalogVersionManifest = {
    version,
    updatedAt: nowIso,
    minAppVersion: minVersionSetting?.value || '1.0.0',
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

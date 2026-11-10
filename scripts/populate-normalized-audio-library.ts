import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('=================================================================');
  console.log('🎙️  Sheikh Zabuur — High-Speed Bulk Normalization');
  console.log('=================================================================\n');

  const tracks = await prisma.audioTrack.findMany();
  console.log(`Loaded ${tracks.length} tracks. Preparing bulk records in memory...`);

  const translationsData: Array<{
    trackId: string;
    locale: string;
    title: string;
  }> = [];

  const mediaObjectsData: Array<{
    sha256: string;
    storageProvider: string;
    bucket: string;
    objectKey: string;
    fileSizeBytes: bigint;
    mimeType: string;
  }> = [];

  const trackToSha = new Map<string, string>();

  for (const track of tracks) {
    if (track.amharicTitle && track.amharicTitle.trim()) {
      translationsData.push({
        trackId: track.id,
        locale: 'am',
        title: track.amharicTitle.trim(),
      });
    }
    if (track.arabicTitle && track.arabicTitle.trim()) {
      translationsData.push({
        trackId: track.id,
        locale: 'ar',
        title: track.arabicTitle.trim(),
      });
    }

    const remoteUrl = track.remoteUrl || '';
    const storageProvider = remoteUrl.includes('archive.org')
      ? 'archive_org'
      : remoteUrl.includes('r2.cloudflarestorage')
      ? 'cloudflare_r2'
      : 'local_storage';

    const bucket = 'shekh-zabur-lectures';
    const objectKey =
      track.storageKey ||
      track.originalFilename ||
      `audio/${track.categoryId}/${track.trackId}.mp3`;

    const sha256 = crypto
      .createHash('sha256')
      .update(`sheikh-zabuur:${track.trackId}:${objectKey}:${track.fileSize}`)
      .digest('hex');

    trackToSha.set(track.id, sha256);

    mediaObjectsData.push({
      sha256,
      storageProvider,
      bucket,
      objectKey,
      fileSizeBytes: track.fileSize || BigInt(0),
      mimeType: 'audio/mpeg',
    });
  }

  console.log(`1. Bulk inserting ${translationsData.length} Translations...`);
  const insertedTranslations = await prisma.audioTrackTranslation.createMany({
    data: translationsData,
    skipDuplicates: true,
  });
  console.log(`   ✔ Inserted ${insertedTranslations.count} translations.`);

  console.log(`2. Bulk inserting ${mediaObjectsData.length} Media Objects...`);
  const insertedMedia = await prisma.mediaObject.createMany({
    data: mediaObjectsData,
    skipDuplicates: true,
  });
  console.log(`   ✔ Inserted ${insertedMedia.count} media objects.`);

  console.log(`3. Bulk inserting ${tracks.length} Audio Assets...`);
  const assetsData = tracks.map((t) => ({
    trackId: t.id,
    purpose: 'streaming',
    status: 'active',
  }));
  const insertedAssets = await prisma.audioAsset.createMany({
    data: assetsData,
    skipDuplicates: true,
  });
  console.log(`   ✔ Inserted ${insertedAssets.count} audio assets.`);

  console.log('4. Linking Audio Asset Versions...');
  const assets = await prisma.audioAsset.findMany({
    where: { purpose: 'streaming' },
    select: { id: true, trackId: true },
  });

  const mediaList = await prisma.mediaObject.findMany({
    select: { id: true, sha256: true },
  });
  const shaToMediaId = new Map(mediaList.map((m) => [m.sha256, m.id]));

  const versionData: Array<{
    audioAssetId: string;
    mediaObjectId: string;
    versionNumber: number;
  }> = [];

  for (const asset of assets) {
    const sha = trackToSha.get(asset.trackId);
    if (sha) {
      const mediaId = shaToMediaId.get(sha);
      if (mediaId) {
        versionData.push({
          audioAssetId: asset.id,
          mediaObjectId: mediaId,
          versionNumber: 1,
        });
      }
    }
  }

  const insertedVersions = await prisma.audioAssetVersion.createMany({
    data: versionData,
    skipDuplicates: true,
  });
  console.log(`   ✔ Linked ${insertedVersions.count} audio asset versions.`);

  console.log('\n✅ High-Speed Bulk Normalization Complete!');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

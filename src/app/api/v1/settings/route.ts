import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [publicSettings, currentBranding] = await Promise.all([
      prisma.systemSetting.findMany({
        where: { isPublic: true },
        select: { key: true, value: true },
      }),
      prisma.appBranding.findFirst({
        where: { isCurrent: true },
      }),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of publicSettings) {
      settingsMap[s.key] = s.value;
    }

    const branding = currentBranding
      ? {
          appName: currentBranding.appName,
          tagline: currentBranding.tagline,
          primaryColor: currentBranding.primaryColor,
          secondaryColor: currentBranding.secondaryColor,
          inAppLogoUrl: currentBranding.inAppLogoUrl,
          logoEmblemUrl: currentBranding.logoEmblemUrl,
          splashScreenUrl: currentBranding.splashScreenUrl,
          loginArtworkUrl: currentBranding.loginArtworkUrl,
          bannerUrls: currentBranding.bannerUrls,
        }
      : null;

    return NextResponse.json(
      {
        min_supported_version: settingsMap['min_mobile_version'] || '1.0.0',
        current_version: settingsMap['app_version'] || '1.0.0',
        maintenance_mode: settingsMap['maintenance_mode'] === 'true',
        maintenance_message: settingsMap['maintenance_message'] || null,
        offline_downloads_enabled: settingsMap['offline_downloads_enabled'] !== 'false',
        playback_streaming_enabled: settingsMap['playback_streaming_enabled'] !== 'false',
        announcement_banner_enabled: settingsMap['announcement_banner_enabled'] !== 'false',
        pdf_reader_enabled: settingsMap['pdf_reader_enabled'] !== 'false',
        branding,
        settings: settingsMap,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('[API Public Settings] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

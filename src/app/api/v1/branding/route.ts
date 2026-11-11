import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const currentBranding = await prisma.appBranding.findFirst({
      where: { isCurrent: true },
    });

    if (!currentBranding) {
      return NextResponse.json({
        appName: 'Sheikh Zabuur',
        tagline: 'Comprehensive Islamic Audio Library',
        primaryColor: '#006B4F',
        secondaryColor: '#D97706',
        inAppLogoUrl: null,
        logoEmblemUrl: null,
        splashScreenUrl: null,
        loginArtworkUrl: null,
        banners: [],
        version: '1.0.0',
      });
    }

    return NextResponse.json({
      appName: currentBranding.appName,
      tagline: currentBranding.tagline,
      primaryColor: currentBranding.primaryColor,
      secondaryColor: currentBranding.secondaryColor,
      inAppLogoUrl: currentBranding.inAppLogoUrl,
      logoEmblemUrl: currentBranding.logoEmblemUrl,
      splashScreenUrl: currentBranding.splashScreenUrl,
      loginArtworkUrl: currentBranding.loginArtworkUrl,
      androidLauncherIconUrl: currentBranding.androidLauncherIconUrl,
      iosAppIconUrl: currentBranding.iosAppIconUrl,
      banners: currentBranding.bannerUrls || [],
      version: currentBranding.version,
      updatedAt: currentBranding.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error('[Public API Branding] Failed to query current branding:', err);
    return NextResponse.json({ error: 'Failed to retrieve branding' }, { status: 500 });
  }
}


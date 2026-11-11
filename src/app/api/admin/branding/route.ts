import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createBrandingSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  appName: z.string().min(1, 'App name is required'),
  tagline: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code'),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code'),
  inAppLogoUrl: z.string().nullable().optional(),
  logoEmblemUrl: z.string().nullable().optional(),
  splashScreenUrl: z.string().nullable().optional(),
  loginArtworkUrl: z.string().nullable().optional(),
  androidLauncherIconUrl: z.string().nullable().optional(),
  iosAppIconUrl: z.string().nullable().optional(),
  bannerUrls: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        imageUrl: z.string(),
        linkUrl: z.string().optional(),
      })
    )
    .optional(),
  activateImmediately: z.boolean().default(false),
});

export async function GET() {
  try {
    await requirePermission('branding:view');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  try {
    const [currentBranding, history] = await Promise.all([
      prisma.appBranding.findFirst({
        where: { isCurrent: true },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.appBranding.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      current: currentBranding,
      history,
    });
  } catch (err) {
    console.error('[API Branding GET] Failed to fetch branding:', err);
    return NextResponse.json({ error: 'Failed to fetch branding' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('branding:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = createBrandingSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  // Check unique version
  const existingVersion = await prisma.appBranding.findUnique({
    where: { version: data.version },
  });

  if (existingVersion) {
    return NextResponse.json(
      { error: `Branding version "${data.version}" already exists. Increment the version number.` },
      { status: 409 }
    );
  }

  try {
    const newBranding = await prisma.$transaction(async (tx) => {
      if (data.activateImmediately) {
        await tx.appBranding.updateMany({
          data: { isCurrent: false },
        });
      }

      return await tx.appBranding.create({
        data: {
          version: data.version,
          appName: data.appName,
          tagline: data.tagline || null,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          inAppLogoUrl: data.inAppLogoUrl || null,
          logoEmblemUrl: data.logoEmblemUrl || null,
          splashScreenUrl: data.splashScreenUrl || null,
          loginArtworkUrl: data.loginArtworkUrl || null,
          androidLauncherIconUrl: data.androidLauncherIconUrl || null,
          iosAppIconUrl: data.iosAppIconUrl || null,
          bannerUrls: data.bannerUrls ? JSON.parse(JSON.stringify(data.bannerUrls)) : undefined,
          isCurrent: data.activateImmediately,
          createdById: user.id,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'BRANDING_VERSION_CREATED',
      entityType: 'AppBranding',
      entityId: newBranding.id,
      details: {
        version: newBranding.version,
        appName: newBranding.appName,
        isCurrent: newBranding.isCurrent,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, branding: newBranding }, { status: 201 });
  } catch (err) {
    console.error('[API Branding POST] Failed to save branding:', err);
    return NextResponse.json({ error: 'Failed to save branding version' }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { compileCatalog } from '@/lib/catalog-compiler';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Check local compiled catalog file
    const localCatalogPath = path.join(process.cwd(), 'public', 'catalog', 'catalog.json');
    try {
      const content = await fs.readFile(localCatalogPath, 'utf-8');
      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      // Local file not ready, compile dynamically
    }

    const activeRelease = await prisma.catalogRelease.findFirst({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });

    const version = activeRelease?.version || '2.0.0';
    const compiled = await compileCatalog(version);

    return new NextResponse(compiled.catalogJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[API Catalog Full] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

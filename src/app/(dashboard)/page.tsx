'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Music,
  FolderTree,
  HardDrive,
  CheckCircle2,
  ArrowRight,
  Volume2,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface PlatformStats {
  tracks: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
  modules: {
    total: number;
  };
  categories: {
    total: number;
  };
  pdfs?: {
    total: number;
    volumes: number;
  };
  storage: {
    totalSizeBytes: string;
    formattedSize: string;
    totalSeconds: number;
    totalHours: string;
  };
  release: {
    activeVersion: string;
    publishedAt: string | null;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchStats() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch dynamic stats:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Dynamic Page Header */}
      <PageHeader
        title="Platform Overview & Content Management"
        description="Comprehensive administration of the Sheikh Zabuur Islamic Audio Library mobile app catalog and media assets."
        badge={
          <StatusBadge
            status="published"
            label={stats ? `Active Release v${stats.release.activeVersion}` : 'Production Ready'}
          />
        }
        actions={
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Live Database Content Repository Metrics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Authoritative Database Content Repository
          </h2>
          <Link
            href="/library"
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Open Library</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Audio Tracks"
            value={stats ? stats.tracks.total.toLocaleString() : '1,731+'}
            subtext={
              stats
                ? `${stats.tracks.published.toLocaleString()} Published • ${stats.tracks.draft} Draft`
                : 'Deterministic immutable IDs'
            }
            icon={Music}
            color="emerald"
            href="/library"
          />

          <StatCard
            label="Kitāb Documents"
            value={stats?.pdfs ? stats.pdfs.total.toLocaleString() : '0'}
            subtext={
              stats?.pdfs
                ? `${stats.pdfs.volumes} Volumes indexed`
                : 'Islamic texts & treatises'
            }
            icon={BookOpen}
            color="teal"
            href="/pdf"
          />

          <StatCard
            label="Curriculum Modules"
            value={stats ? stats.modules.total : '8'}
            subtext="Beyquna, Usul, Tafseer, Bulugh, etc."
            icon={Layers}
            color="blue"
            href="/modules"
          />

          <StatCard
            label="Active Categories"
            value={stats ? stats.categories.total : '105'}
            subtext="Hierarchical root & subcategories"
            icon={FolderTree}
            color="purple"
            href="/categories"
          />

          <StatCard
            label="Total Audio Size"
            value={stats ? stats.storage.formattedSize : '36.85 GB'}
            subtext={stats ? `${stats.storage.totalHours} total audio hours` : '1,393.55 audio hours'}
            icon={HardDrive}
            color="amber"
          />
        </div>
      </div>

      {/* Feature Navigation Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Audio Library & Normalized Architecture
              </h3>
              <p className="text-xs text-slate-500">Live search, filtering, and instant updates</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Comprehensive Search:</strong> Fast debounced querying by track title, Amharic name, Arabic name, track ID, and original filename.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Multi-Level Filtering:</strong> Filter by curriculum module, category, and publication status (Published vs Draft).
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Audited Edits:</strong> Updating titles and track numbers logs IP and admin identity to <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">AuditLog</code>.
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <span>Explore Audio Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                In-Browser Audio Preview Engine
              </h3>
              <p className="text-xs text-slate-500">Persistent floating streaming player</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Direct CDN Streaming:</strong> Stream audio recordings instantly from Cloudflare R2 / CDN without downloading locally.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Full Scrubbing & Playback Rates:</strong> Seekable waveform-style timeline, 10s skip controls, volume slider, and 0.75x–2x speed selector.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Persistent Context:</strong> Audio keeps playing seamlessly across tabs and pages in the admin portal.
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/modules"
              className="inline-flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
            >
              <span>Inspect Curriculum Modules</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Master Implementation Roadmap Tracker */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Master Architecture & Implementation Roadmap
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 1 — Foundation</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Next.js 15 App Shell, TypeScript Strict, Tailwind, Prisma schema, and Zod env validator.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 2 — Auth & RBAC</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Argon2id hashing, secure session management, RBAC matrix, and Super Admin bootstrap.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 3 — Catalog Ingestion</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              1,731 audio tracks, 8 modules, 105 categories, and initial release seeded in Neon PostgreSQL.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 4 — Content Management</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Searchable audio library, module/category tree, metadata editor, and audio preview player.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 5 — Cloud Audio Upload</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Direct-to-cloud presigned S3/R2 uploads, client audio inspection, and atomic draft creation.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 6 — Catalog Publishing</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Atomic catalog compiler, semver versioning, R2 deployment, and instant mobile rollback.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 7 — Announcements & Push</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              In-app announcements, push token registration, and Expo Push Notification broadcaster.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 8 — Usage Analytics & Audit</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Operational dashboard metrics, audit trail viewer, system settings, and user management.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 9 — Production Hardening & CI/CD</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Rate limiting, security headers, connection pooling, CI/CD pipeline, and Vercel readiness.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

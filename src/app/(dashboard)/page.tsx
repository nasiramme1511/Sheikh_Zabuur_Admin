import React from 'react';
import Link from 'next/link';
import {
  Layers,
  Music,
  FolderTree,
  HardDrive,
  CheckCircle2,
  ArrowRight,
  Volume2,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Platform Overview & Content Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Phase 4 Active: 1,731 Audio Recordings, 105 Categories, Full Metadata Editor & In-Browser Audio Player
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Phase 4 Complete
          </span>
        </div>
      </div>

      {/* Verified Mobile Catalog Targets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Live Database Content Repository
          </h2>
          <Link
            href="/library"
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Open Library</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/library"
            className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Recordings</span>
              <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Music className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">1,731</div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span>Deterministic track IDs verified</span>
                <ArrowRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
          </Link>

          <Link
            href="/modules"
            className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Root Modules</span>
              <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">8</div>
              <p className="text-xs text-slate-500 mt-1">Beyquna, Usul, Tafseer, Bulugh, etc.</p>
            </div>
          </Link>

          <Link
            href="/categories"
            className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-purple-500/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Categories</span>
              <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <FolderTree className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">105</div>
              <p className="text-xs text-slate-500 mt-1">103 root + 2 nested subcategories</p>
            </div>
          </Link>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Audio Size</span>
              <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">36.85 GB</div>
              <p className="text-xs text-slate-500 mt-1">1,393.55 total audio hours</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Management Feature Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Audio Library & Metadata Editor
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

      {/* Implementation Roadmap Tracker */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Master Implementation Roadmap
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 1 — Foundation</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Next.js 15 App Shell, TypeScript, Tailwind, Prisma schema, and Zod env validator.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 2 — Auth & RBAC</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">DONE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Argon2id hashing, secure session management, RBAC, and Super Admin bootstrap.
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
              In-app announcements, push token registration, and Expo Push Notification broadcast.
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
              Security audit, rate limiting, connection pooling, CI/CD pipeline, and Vercel production deployment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

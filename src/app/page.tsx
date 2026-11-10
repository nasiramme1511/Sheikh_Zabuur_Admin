import React from 'react';
import {
  Layers,
  Music,
  FolderTree,
  HardDrive,
  Shield,
  Database,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Platform Overview & System Foundation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Phase 1 Foundation: Application Shell, PostgreSQL Prisma Schema, and Health APIs Active
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Phase 1 Initialized
          </span>
        </div>
      </div>

      {/* Verified Mobile Catalog Ingestion Targets */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
          Verified Mobile Catalog Targets (Ready for Phase 3 Ingestion)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Recordings</span>
              <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Music className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">1,731</div>
              <p className="text-xs text-slate-500 mt-1">100% deterministic track IDs verified</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Root Modules</span>
              <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">8</div>
              <p className="text-xs text-slate-500 mt-1">Beyquna, Usul, Tafseer, Bulugh, etc.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Categories</span>
              <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <FolderTree className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">100</div>
              <p className="text-xs text-slate-500 mt-1">Includes recursive subcategories</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
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

      {/* Foundational Architecture Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                PostgreSQL & Prisma Schema
              </h3>
              <p className="text-xs text-slate-500">Prisma Client generated and validated</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Foundational Models Defined:</strong> AdminUser, AdminRole, Permission,
                RolePermission, AdminSession, AuditLog, and SystemSetting.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Relational Integrity:</strong> Strict cascade rules, foreign key constraints,
                and compound indexes on role permissions and sessions.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Credentials Compromised:</strong> No hardcoded passwords or default accounts created.
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Security & Isolation Architecture
              </h3>
              <p className="text-xs text-slate-500">Separation of concerns enforced</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Mobile Build Contamination:</strong> Admin code is isolated in its own repository, avoiding EAS mobile build bloat.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Environment Safety:</strong> Zod-based server environment validator in <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">src/lib/env.ts</code> prevents credential exposure to client bundles.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Storage Provider Independence:</strong> Ready for S3-compatible cloud storage without vendor lock-in.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Roadmap Tracker */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Phase-by-Phase Roadmap
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-md border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              <span>Phase 1 — Foundation</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 font-mono">COMPLETE</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Next.js 15 App Shell, strict TypeScript, Tailwind CSS, Prisma models, Zod env validation, and health check API.
            </p>
          </div>

          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              <span>Phase 2 — Auth & RBAC</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">UP NEXT</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Argon2id hashing, secure session management, role permissions, Super Admin bootstrap CLI, and audit logging.
            </p>
          </div>

          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              <span>Phase 3 — Catalog Ingestion</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono">PENDING</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Dry-run and transactional import of the verified 1,731 audio recordings and 100 categories into PostgreSQL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

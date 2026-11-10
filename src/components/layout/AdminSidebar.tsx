'use client';

import {
  Bell,
  ClipboardList,
  FolderTree,
  Layers,
  LayoutDashboard,
  Music,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Tags,
  UploadCloud,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: number;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', href: '/', icon: LayoutDashboard, phase: 1 },
  { name: 'Audio Library', href: '/library', icon: Music, phase: 4 },
  { name: 'Modules', href: '/modules', icon: FolderTree, phase: 4 },
  { name: 'Categories', href: '/categories', icon: Tags, phase: 4 },
  { name: 'Upload Center', href: '/upload', icon: UploadCloud, phase: 5 },
  { name: 'Catalog Releases', href: '/releases', icon: Layers, phase: 6 },
  { name: 'Announcements', href: '/announcements', icon: Bell, phase: 7 },
  { name: 'Push Notifications', href: '/push', icon: Send, phase: 7 },
  { name: 'Admin Users', href: '/users', icon: Users, phase: 2 },
  { name: 'Roles & Permissions', href: '/roles', icon: ShieldAlert, phase: 2 },
  { name: 'Audit Logs', href: '/audit', icon: ClipboardList, phase: 2 },
  { name: 'System Settings', href: '/settings', icon: Settings, phase: 1 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-200 dark:border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">
          <Sparkles className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h1 className="font-semibold text-sm leading-tight text-slate-900 dark:text-slate-100">
            Sheikh Zabuur
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Admin Platform</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Content & Management
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isAvailable = item.phase <= 6;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={isAvailable ? item.href : '#'}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  : isAvailable
                    ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    : 'text-slate-400 dark:text-slate-600 hover:bg-transparent cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isAvailable
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-300 dark:text-slate-700'
                  }`}
                />
                <span>{item.name}</span>
              </div>

              {!isAvailable && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                  P{item.phase}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-3 border border-emerald-100 dark:border-emerald-900/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Phase 6 Active
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-normal">
            Catalog Publishing & Rollback Live
          </p>
        </div>
      </div>
    </aside>
  );
}
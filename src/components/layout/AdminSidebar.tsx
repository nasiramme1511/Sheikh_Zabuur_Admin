'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { APP_NAVIGATION, APP_METADATA } from '@/config/navigation';

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
            {APP_METADATA.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{APP_METADATA.subtitle}</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Content & Management
        </div>

        {APP_NAVIGATION.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Production Status Banner */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-3 border border-emerald-100 dark:border-emerald-900/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              System Ready
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-normal">
            Production Platform Live • v{APP_METADATA.version}
          </p>
        </div>
      </div>
    </aside>
  );
}

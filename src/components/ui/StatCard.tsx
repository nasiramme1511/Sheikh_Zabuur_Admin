import React from 'react';
import Link from 'next/link';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'slate';
  href?: string;
}

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-600 dark:text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/50',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-600 dark:text-blue-400',
    hoverBorder: 'hover:border-blue-500/50',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-600 dark:text-purple-400',
    hoverBorder: 'hover:border-purple-500/50',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    text: 'text-amber-600 dark:text-amber-400',
    hoverBorder: 'hover:border-amber-500/50',
  },
  slate: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    hoverBorder: 'hover:border-slate-500/50',
  },
};

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  color = 'emerald',
  href,
}: StatCardProps) {
  const styles = COLOR_MAP[color];

  const content = (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-all ${
        href ? `${styles.hoverBorder} group cursor-pointer` : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div
          className={`w-8 h-8 rounded-md ${styles.bg} flex items-center justify-center ${styles.text} ${
            href ? 'group-hover:scale-105 transition-transform' : ''
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
        {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

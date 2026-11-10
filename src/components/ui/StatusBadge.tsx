import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Archive, Send, XCircle } from 'lucide-react';

export type StatusVariant =
  | 'published'
  | 'draft'
  | 'archived'
  | 'active'
  | 'inactive'
  | 'sent'
  | 'failed'
  | 'sending';

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: 'sm' | 'md';
}

const BADGE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; style: string }
> = {
  published: {
    label: 'Published',
    icon: CheckCircle2,
    style:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  active: {
    label: 'Active',
    icon: CheckCircle2,
    style:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  draft: {
    label: 'Draft',
    icon: Clock,
    style:
      'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    style:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  inactive: {
    label: 'Inactive',
    icon: XCircle,
    style:
      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  sent: {
    label: 'Sent',
    icon: Send,
    style:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  failed: {
    label: 'Failed',
    icon: AlertCircle,
    style:
      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  sending: {
    label: 'Sending',
    icon: Clock,
    style:
      'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
};

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const normalizedKey = status.toLowerCase();
  const config = BADGE_CONFIG[normalizedKey] || {
    label: status,
    icon: Clock,
    style: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const Icon = config.icon;
  const displayLabel = label || config.label;
  const textClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${textClass} ${config.style}`}
    >
      <Icon className={`${iconClass} shrink-0`} />
      <span>{displayLabel}</span>
    </span>
  );
}

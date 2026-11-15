'use client';

import { APP_METADATA } from '@/config/navigation';
import { Activity, Loader2, LogOut, Menu, ShieldCheck, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMobileNav } from '@/contexts/MobileNavContext';

interface AuthUserData {
  id: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  permissions: string[];
}

export function AdminHeader() {
  const router = useRouter();
  const { toggle: toggleMobileNav } = useMobileNav();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'degraded' | 'error'>(
    'checking'
  );
  const [user, setUser] = useState<AuthUserData | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setHealthStatus(data.status === 'ok' ? 'ok' : 'degraded');
        } else {
          setHealthStatus('error');
        }
      } catch {
        setHealthStatus('error');
      }
    }

    async function fetchMe() {
      try {
        const res = await fetch('/api/admin/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
          }
        }
      } catch {
        // Ignored, unauthenticated fallback handled by middleware
      }
    }

    checkHealth();
    fetchMe();
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5 md:gap-3">
        <button
          onClick={toggleMobileNav}
          className="md:hidden p-1.5 -ml-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[180px] sm:max-w-none">
          {APP_METADATA.fullTitle}
        </h2>
        <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          v{APP_METADATA.version}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* System Health Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>API:</span>
          {healthStatus === 'checking' && (
            <span className="text-slate-400 font-medium">Checking...</span>
          )}
          {healthStatus === 'ok' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Healthy</span>
          )}
          {healthStatus === 'degraded' && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">Ready (DB Unset)</span>
          )}
          {healthStatus === 'error' && (
            <span className="text-rose-600 dark:text-rose-400 font-medium">Error</span>
          )}
        </div>

        {/* Authenticated User Profile & Logout */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                {user?.name || 'Administrator'}
                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {user?.roleName || user?.role || 'Authenticated'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Sign out of administration"
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {isLoggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

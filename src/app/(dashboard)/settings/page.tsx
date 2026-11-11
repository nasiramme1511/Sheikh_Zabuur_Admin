'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Sliders,
  Cloud,
  ShieldCheck,
  Info,
} from 'lucide-react';

interface SystemSettingItem {
  key: string;
  value: string;
  description?: string | null;
  isPublic: boolean;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'mobile' | 'features' | 'storage' | 'security'>('mobile');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      const sMap: Record<string, string> = {};

      (data.settings || []).forEach((item: SystemSettingItem) => {
        sMap[item.key] = item.value;
      });

      // Default fallbacks
      if (!sMap.app_version) sMap.app_version = '1.0.0';
      if (!sMap.min_mobile_version) sMap.min_mobile_version = '1.0.0';
      if (!sMap.maintenance_mode) sMap.maintenance_mode = 'false';
      if (!sMap.maintenance_message) sMap.maintenance_message = 'Sheikh Zabuur audio platform is currently undergoing scheduled maintenance. Please check back shortly.';
      if (!sMap.offline_downloads_enabled) sMap.offline_downloads_enabled = 'true';
      if (!sMap.playback_streaming_enabled) sMap.playback_streaming_enabled = 'true';
      if (!sMap.announcement_banner_enabled) sMap.announcement_banner_enabled = 'true';
      if (!sMap.pdf_reader_enabled) sMap.pdf_reader_enabled = 'true';
      if (!sMap.cdn_cache_ttl_seconds) sMap.cdn_cache_ttl_seconds = '86400';
      if (!sMap.max_login_attempts) sMap.max_login_attempts = '5';
      if (!sMap.session_expiry_days) sMap.session_expiry_days = '7';

      setSettings(sMap);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setStatusMessage({ type: 'success', text: 'System settings successfully saved and synced.' });
      setTimeout(() => setStatusMessage(null), 5000);
      await fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving settings';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            System Settings & Remote Configuration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure mobile client version constraints, remote feature flags, Cloudflare R2 policies, and security parameters.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/60 border border-red-200 text-red-800 dark:text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('mobile')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'mobile'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Mobile Version & Maintenance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('features')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'features'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Feature Flags</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('storage')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'storage'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Storage & Cloud CDN</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'security'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security & Audit Policies</span>
        </button>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Tab 1: Mobile Version & Maintenance */}
        {activeTab === 'mobile' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Mobile Version Compatibility & Maintenance Gate
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control which versions of the Sheikh Zabuur mobile app are allowed to connect, and trigger maintenance alerts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Current Official App Release Version
                </label>
                <input
                  type="text"
                  value={settings.app_version || '1.0.0'}
                  onChange={(e) => setSettings({ ...settings, app_version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  Published in the remote configuration endpoint for version checking.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Minimum Supported App Version (Hard Floor)
                </label>
                <input
                  type="text"
                  value={settings.min_mobile_version || '1.0.0'}
                  onChange={(e) => setSettings({ ...settings, min_mobile_version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  Clients running older builds will receive an update prompt upon launch.
                </p>
              </div>
            </div>

            {/* Maintenance Mode Card */}
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-xs text-amber-900 dark:text-amber-200">
                    Emergency Maintenance Mode
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    When active, mobile clients display an operational alert. Existing offline downloads remain fully playable.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.maintenance_mode === 'true'}
                    onChange={(e) =>
                      setSettings({ ...settings, maintenance_mode: e.target.checked ? 'true' : 'false' })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {settings.maintenance_mode === 'true' && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    Custom Maintenance Message (Displayed in Mobile App)
                  </label>
                  <textarea
                    rows={2}
                    value={settings.maintenance_message || ''}
                    onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Feature Flags */}
        {activeTab === 'features' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Mobile Capability Toggles & Feature Flags
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enable or disable mobile capabilities without shipping App Store / Google Play updates.
              </p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              {/* Offline Downloads */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Offline Audio Track Downloads
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Permit mobile users to save MP3 darses locally to SQLite persistence.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.offline_downloads_enabled !== 'false'}
                    onChange={(e) =>
                      setSettings({ ...settings, offline_downloads_enabled: e.target.checked ? 'true' : 'false' })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Direct CDN Audio Streaming */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Direct Cloud CDN Streaming
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Permit users to stream recordings on-demand directly over the network without prior local download.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.playback_streaming_enabled !== 'false'}
                    onChange={(e) =>
                      setSettings({ ...settings, playback_streaming_enabled: e.target.checked ? 'true' : 'false' })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* In-App Announcement Banners */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    In-App Announcement Banners
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Display global banner broadcasts at the top of the mobile home curriculum feed.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.announcement_banner_enabled !== 'false'}
                    onChange={(e) =>
                      setSettings({ ...settings, announcement_banner_enabled: e.target.checked ? 'true' : 'false' })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* PDF In-App Kitāb Reader */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Kitāb PDF Reader Integration
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Display the Kitāb PDF button on category screens for students to study texts alongside darses.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.pdf_reader_enabled !== 'false'}
                    onChange={(e) =>
                      setSettings({ ...settings, pdf_reader_enabled: e.target.checked ? 'true' : 'false' })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Storage & Cloud CDN */}
        {activeTab === 'storage' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cloudflare R2 Storage & CDN Acceleration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-region S3-compatible cloud object storage configuration with zero egress fees.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Storage Provider: Cloudflare R2 (S3 Protocol)
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Cloudflare R2 provides zero-egress cost object storage for 36.85+ GB of Sheikh Zabuur audio recordings, Kitāb PDFs, and branding artwork. In local development or staging, the platform seamlessly falls back to local simulation mode with byte-range HTTP streaming.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Catalog CDN Cache TTL (Seconds)
                </label>
                <input
                  type="number"
                  value={settings.cdn_cache_ttl_seconds || '86400'}
                  onChange={(e) => setSettings({ ...settings, cdn_cache_ttl_seconds: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  Controls Edge cache expiration for <code className="font-mono">catalog.json</code> (86400s = 24h).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Security & Audit Policies */}
        {activeTab === 'security' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Security Controls & Audit Policies
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Administrator authentication thresholds, session expiration parameters, and audit safeguards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Max Consecutive Failed Login Attempts
                </label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={settings.max_login_attempts || '5'}
                  onChange={(e) => setSettings({ ...settings, max_login_attempts: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  Accounts are locked for 15 minutes after reaching this threshold.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Admin Session Expiry Window (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.session_expiry_days || '7'}
                  onChange={(e) => setSettings({ ...settings, session_expiry_days: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  Length of time cryptographic session cookies remain valid before re-authentication.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Action Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving System Configuration...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

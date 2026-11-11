'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Palette,
  Sparkles,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
} from 'lucide-react';

interface BannerItem {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
}

interface BrandingItem {
  id: string;
  version: string;
  appName: string;
  tagline?: string | null;
  primaryColor: string;
  secondaryColor: string;
  inAppLogoUrl?: string | null;
  logoEmblemUrl?: string | null;
  splashScreenUrl?: string | null;
  loginArtworkUrl?: string | null;
  androidLauncherIconUrl?: string | null;
  iosAppIconUrl?: string | null;
  bannerUrls?: BannerItem[] | null;
  isCurrent: boolean;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string } | null;
}

export default function BrandingPage() {
  const [currentBranding, setCurrentBranding] = useState<BrandingItem | null>(null);
  const [history, setHistory] = useState<BrandingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [version, setVersion] = useState('');
  const [appName, setAppName] = useState('Sheikh Zabuur');
  const [tagline, setTagline] = useState('Comprehensive Islamic Audio Library');
  const [primaryColor, setPrimaryColor] = useState('#006B4F');
  const [secondaryColor, setSecondaryColor] = useState('#D97706');
  const [inAppLogoUrl, setInAppLogoUrl] = useState('');
  const [logoEmblemUrl, setLogoEmblemUrl] = useState('');
  const [splashScreenUrl, setSplashScreenUrl] = useState('');
  const [loginArtworkUrl, setLoginArtworkUrl] = useState('');
  const [androidLauncherIconUrl, setAndroidLauncherIconUrl] = useState('');
  const [iosAppIconUrl, setIosAppIconUrl] = useState('');
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [activateImmediately, setActivateImmediately] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');

  const fetchBranding = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/branding');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCurrentBranding(data.current);
          setHistory(data.history || []);

          if (data.current) {
            setAppName(data.current.appName || 'Sheikh Zabuur');
            setTagline(data.current.tagline || '');
            setPrimaryColor(data.current.primaryColor || '#006B4F');
            setSecondaryColor(data.current.secondaryColor || '#D97706');
            setInAppLogoUrl(data.current.inAppLogoUrl || '');
            setLogoEmblemUrl(data.current.logoEmblemUrl || '');
            setSplashScreenUrl(data.current.splashScreenUrl || '');
            setLoginArtworkUrl(data.current.loginArtworkUrl || '');
            setAndroidLauncherIconUrl(data.current.androidLauncherIconUrl || '');
            setIosAppIconUrl(data.current.iosAppIconUrl || '');
            setBanners(data.current.bannerUrls || []);

            // Suggest next patch version
            const parts = (data.current.version || '1.0.0').split('.');
            if (parts.length === 3) {
              const nextPatch = parseInt(parts[2], 10) + 1;
              setVersion(`${parts[0]}.${parts[1]}.${nextPatch}`);
            } else {
              setVersion('1.1.0');
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load branding:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const handleActivate = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/branding/${id}/activate`, { method: 'POST' });
      if (res.ok) {
        setActionSuccessMsg('Branding version activated successfully.');
        setTimeout(() => setActionSuccessMsg(''), 4000);
        fetchBranding();
      } else {
        const err = await res.json();
        setActionErrorMsg(err.error || 'Failed to activate branding');
      }
    } catch (err) {
      console.error(err);
      setActionErrorMsg('Network error while activating branding');
    }
  };

  const handleCreateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionErrorMsg('');
    setActionSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version,
          appName,
          tagline: tagline || null,
          primaryColor,
          secondaryColor,
          inAppLogoUrl: inAppLogoUrl || null,
          logoEmblemUrl: logoEmblemUrl || null,
          splashScreenUrl: splashScreenUrl || null,
          loginArtworkUrl: loginArtworkUrl || null,
          androidLauncherIconUrl: androidLauncherIconUrl || null,
          iosAppIconUrl: iosAppIconUrl || null,
          bannerUrls: banners,
          activateImmediately,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create branding version');
      }

      setActionSuccessMsg(`Branding version ${version} published successfully!`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      fetchBranding();
    } catch (err: unknown) {
      console.error(err);
      setActionErrorMsg(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBanner = () => {
    const newId = `banner-${Date.now()}`;
    setBanners([
      ...banners,
      {
        id: newId,
        title: 'Ramadan 1448 Lecture Series',
        imageUrl: 'https://cdn.sheikhzabur.com/branding/banners/banner-sample.jpg',
        linkUrl: '/library',
      },
    ]);
  };

  const handleRemoveBanner = (id: string) => {
    setBanners(banners.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Palette}
        title="App Branding & Visual Identity"
        description="Manage the mobile application's colors, in-app logo assets, promotional banners, and native build icons."
        badge={
          currentBranding ? (
            <StatusBadge status="published" label={`Active: v${currentBranding.version}`} />
          ) : (
            'Default Identity'
          )
        }
        actions={
          <button
            onClick={() => fetchBranding()}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="p-3 text-xs rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}
      {actionErrorMsg && (
        <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionErrorMsg}</span>
        </div>
      )}

      {/* Top Grid: Live Preview & Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Editor (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Configure New Branding Release
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Active: {currentBranding?.version || '1.0.0'}
            </span>
          </div>

          <form onSubmit={handleCreateBranding} className="space-y-4 text-xs">
            {/* Version & App Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Branding Version *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1.1.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Application Name *
                </label>
                <input
                  type="text"
                  required
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                App Tagline / Subtitle
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Comprehensive Islamic Audio Library"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Secondary Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Remotely Updateable In-App Assets */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  In-App Assets
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                  🟢 Remotely Updateable
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">In-App Logo URL</label>
                  <input
                    type="text"
                    placeholder="https://.../brand/logo.png"
                    value={inAppLogoUrl}
                    onChange={(e) => setInAppLogoUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Emblem / Badge Icon URL</label>
                  <input
                    type="text"
                    placeholder="https://.../brand/emblem.png"
                    value={logoEmblemUrl}
                    onChange={(e) => setLogoEmblemUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Splash Screen Artwork URL</label>
                  <input
                    type="text"
                    placeholder="https://.../brand/splash.png"
                    value={splashScreenUrl}
                    onChange={(e) => setSplashScreenUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Login Screen Art URL</label>
                  <input
                    type="text"
                    placeholder="https://.../brand/artwork.png"
                    value={loginArtworkUrl}
                    onChange={(e) => setLoginArtworkUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Native Launcher Icons Notice */}
            <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Native Build Launcher Icons</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900/70">
                  Requires EAS / Native Rebuild
                </span>
              </div>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                App icon assets configured here will be used in the next Expo EAS cloud build cycle (`app.json` / native assets), but cannot dynamically change the icon on a user&apos;s phone without an app update.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] text-amber-800 dark:text-amber-300 mb-0.5">
                    Android Adaptive Icon Asset
                  </label>
                  <input
                    type="text"
                    placeholder="/brand/icon-android.png"
                    value={androidLauncherIconUrl}
                    onChange={(e) => setAndroidLauncherIconUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-amber-800 dark:text-amber-300 mb-0.5">
                    iOS App Icon Asset (1024x1024)
                  </label>
                  <input
                    type="text"
                    placeholder="/brand/icon-ios.png"
                    value={iosAppIconUrl}
                    onChange={(e) => setIosAppIconUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* In-App Promotional Banners */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Promotional Banners ({banners.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddBanner}
                  className="px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Banner</span>
                </button>
              </div>

              {banners.map((b, idx) => (
                <div
                  key={b.id || idx}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-3"
                >
                  <div className="flex-1 grid grid-cols-3 gap-2 text-[11px]">
                    <input
                      type="text"
                      placeholder="Banner Title"
                      value={b.title}
                      onChange={(e) => {
                        const next = [...banners];
                        next[idx].title = e.target.value;
                        setBanners(next);
                      }}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={b.imageUrl}
                      onChange={(e) => {
                        const next = [...banners];
                        next[idx].imageUrl = e.target.value;
                        setBanners(next);
                      }}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      placeholder="Target Link (optional)"
                      value={b.linkUrl || ''}
                      onChange={(e) => {
                        const next = [...banners];
                        next[idx].linkUrl = e.target.value;
                        setBanners(next);
                      }}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveBanner(b.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="activateNow"
                checked={activateImmediately}
                onChange={(e) => setActivateImmediately(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="activateNow" className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                Activate immediately upon publishing (Live for all mobile users)
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Publish Branding Release v{version || '...'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Live Mobile Smartphone Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 w-full max-w-xs">
            <div className="text-center mb-3">
              <span className="text-xs font-semibold text-slate-500 flex items-center justify-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Live In-App Visual Simulation
              </span>
            </div>

            {/* Phone Frame */}
            <div className="w-full aspect-[9/18.5] bg-slate-900 rounded-[38px] p-3 shadow-2xl border-4 border-slate-800 relative overflow-hidden flex flex-col">
              {/* Camera Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full z-20" />

              {/* Screen Content */}
              <div className="flex-1 w-full bg-slate-950 rounded-[28px] overflow-hidden flex flex-col text-white pt-7">
                {/* Simulated Header */}
                <div
                  className="px-4 py-3 flex items-center justify-between shadow-sm transition-colors duration-300"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: secondaryColor, color: '#FFFFFF' }}
                    >
                      SZ
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-none tracking-tight">{appName}</div>
                      <div className="text-[9px] opacity-80 mt-0.5 leading-none">
                        {tagline ? tagline.slice(0, 22) + '...' : 'Islamic Audio'}
                      </div>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                </div>

                {/* Simulated Banner */}
                {banners.length > 0 && (
                  <div className="p-3">
                    <div
                      className="w-full p-2.5 rounded-xl text-white text-[10px] font-semibold flex items-center justify-between"
                      style={{
                        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                      }}
                    >
                      <span>{banners[0].title}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-black/30">Dars</span>
                    </div>
                  </div>
                )}

                {/* Simulated Library List */}
                <div className="flex-1 px-3 space-y-2 overflow-hidden opacity-90">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                    Modules
                  </div>
                  {['Bayquna', 'Usul Al-Thalatha', 'Tafseer Al-Quran'].map((mod, i) => (
                    <div
                      key={mod}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold"
                          style={{
                            backgroundColor: i === 0 ? primaryColor : '#1e293b',
                            color: '#ffffff',
                          }}
                        >
                          {i + 1}
                        </div>
                        <span className="text-[11px] font-medium text-slate-200">{mod}</span>
                      </div>
                      <span className="text-[9px] text-slate-500">14 tracks</span>
                    </div>
                  ))}
                </div>

                {/* Simulated MiniPlayer */}
                <div
                  className="p-2.5 border-t border-slate-800 flex items-center justify-between"
                  style={{ backgroundColor: `${primaryColor}22` }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      ▶
                    </div>
                    <div>
                      <div className="text-[10px] font-medium">BYKN 01 - Dars</div>
                      <div className="text-[8px] text-slate-400">10:37</div>
                    </div>
                  </div>
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    ★
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Branding Version History & Rollback */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Branding Release History & Instant Rollback
            </h3>
          </div>
          <span className="text-xs text-slate-500">{history.length} Versions Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-6">Version</th>
                <th className="py-3 px-4">App Title</th>
                <th className="py-3 px-4">Color Palette</th>
                <th className="py-3 px-4">Banners</th>
                <th className="py-3 px-4">Release Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-6 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    v{item.version}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.appName}
                    </span>
                    {item.tagline && (
                      <div className="text-[11px] text-slate-400">{item.tagline}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-slate-300 shadow-sm"
                        style={{ backgroundColor: item.primaryColor }}
                        title={`Primary: ${item.primaryColor}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-slate-300 shadow-sm"
                        style={{ backgroundColor: item.secondaryColor }}
                        title={`Secondary: ${item.secondaryColor}`}
                      />
                      <span className="text-[11px] font-mono text-slate-400">
                        {item.primaryColor}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                    {item.bannerUrls?.length || 0} active
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4">
                    {item.isCurrent ? (
                      <StatusBadge status="published" label="Active" />
                    ) : (
                      <span className="text-[11px] text-slate-400">Archived</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {!item.isCurrent && (
                      <button
                        onClick={() => handleActivate(item.id)}
                        className="px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 ml-auto border border-emerald-200 dark:border-emerald-800/60"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rollback to v{item.version}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

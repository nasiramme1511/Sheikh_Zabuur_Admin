'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Smartphone,
  Apple,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
} from 'lucide-react';

interface PushStats {
  totalActive: number;
  iosCount: number;
  androidCount: number;
  otherCount: number;
  totalBroadcasts: number;
}

interface BroadcastItem {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  status: string;
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  sentAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  sentBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function PushNotificationsPage() {
  const [stats, setStats] = useState<PushStats>({
    totalActive: 0,
    iosCount: 0,
    androidCount: 0,
    otherCount: 0,
    totalBroadcasts: 0,
  });
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Composer State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'ios' | 'android'>('all');
  const [previewPlatform, setPreviewPlatform] = useState<'ios' | 'android'>('ios');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, broadRes] = await Promise.all([
        fetch('/api/admin/push/stats'),
        fetch('/api/admin/push/broadcasts'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (broadRes.ok) {
        const broadData = await broadRes.json();
        setBroadcasts(broadData.broadcasts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    if (!confirm(`Are you sure you want to broadcast this push notification to ${targetAudience.toUpperCase()} users?`)) {
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/admin/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetAudience,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch broadcast');

      setSendResult({
        success: true,
        message: `Notification broadcast dispatched! Targeted ${data.broadcast.totalTargeted} device(s).`,
      });

      setTitle('');
      setBody('');
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending broadcast';
      setSendResult({ success: false, message: msg });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Push Notification Dispatcher
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Broadcast remote push notifications directly to active mobile devices via Expo Server Push Gateway.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Device Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Devices</span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalActive.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">Ready to receive push alerts</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Apple iOS</span>
            <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <Apple className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.iosCount.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">Registered iPhones & iPads</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Google Android</span>
            <div className="w-8 h-8 rounded-md bg-green-50 dark:bg-green-950/60 flex items-center justify-center text-green-600 dark:text-green-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.androidCount.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">Android mobile devices</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Broadcasts</span>
            <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalBroadcasts.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">Campaigns sent to date</p>
          </div>
        </div>
      </div>

      {/* Main Composer & Lock Screen Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Composer Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Compose Broadcast Message
            </h2>
            <span className="text-xs text-slate-500">Expo Server Push Gateway</span>
          </div>

          {sendResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                sendResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-700 dark:text-red-300'
              }`}
            >
              {sendResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{sendResult.message}</span>
            </div>
          )}

          <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
            {/* Target Audience */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Target Audience
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetAudience('all')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    targetAudience === 'all'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  All Devices ({stats.totalActive})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetAudience('ios')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    targetAudience === 'ios'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  iOS Only ({stats.iosCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetAudience('android')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    targetAudience === 'android'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  Android Only ({stats.androidCount})
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Notification Title <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">{title.length}/100</span>
              </div>
              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New Dars Uploaded: Surah Al-Kahf"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Notification Message Body <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">{body.length}/500</span>
              </div>
              <textarea
                rows={4}
                maxLength={500}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your push notification message in English or Afaan Oromoo (Fkn: Darsiin Tafsiiraa haaraan gadhiifameera)..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSending || !title.trim() || !body.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Broadcasting to Devices...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Push Broadcast</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Lock Screen Simulation Preview */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Live Lock Screen Preview
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
              <button
                type="button"
                onClick={() => setPreviewPlatform('ios')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  previewPlatform === 'ios'
                    ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100'
                    : 'text-slate-500'
                }`}
              >
                iOS
              </button>
              <button
                type="button"
                onClick={() => setPreviewPlatform('android')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  previewPlatform === 'android'
                    ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100'
                    : 'text-slate-500'
                }`}
              >
                Android
              </button>
            </div>
          </div>

          {/* Smartphone Frame Mockup */}
          <div className="w-full max-w-[300px] h-[440px] bg-slate-900 rounded-[36px] p-3 shadow-2xl border-4 border-slate-800 relative flex flex-col justify-between overflow-hidden">
            {/* Dynamic Island / Notch */}
            <div className="w-24 h-4 bg-black rounded-full mx-auto mb-2" />

            {/* Lock Screen Time */}
            <div className="text-center text-white my-auto space-y-1">
              <div className="text-[10px] text-slate-400 font-medium">Wednesday, November 11</div>
              <div className="text-5xl font-light tracking-tight">12:30</div>
            </div>

            {/* Notification Card */}
            <div className="mb-8 animate-in fade-in slide-in-from-bottom duration-300">
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/20 text-slate-900 dark:text-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center text-white text-[9px] font-bold">
                      SZ
                    </div>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      Sheikh Zabuur
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">now</span>
                </div>

                <div className="font-semibold text-xs leading-snug">
                  {title.trim() || 'Notification Title Preview'}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight mt-0.5 line-clamp-3">
                  {body.trim() || 'Your message preview will appear here in real-time as you compose...'}
                </div>
              </div>
            </div>

            {/* Bottom bar indicator */}
            <div className="w-28 h-1 bg-white/40 rounded-full mx-auto mt-auto mb-1" />
          </div>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Push Broadcast History ({broadcasts.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Title & Message</th>
                <th className="py-3 px-4">Audience</th>
                <th className="py-3 px-4">Delivery Stats</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sent At</th>
                <th className="py-3 px-4 text-right">Sender</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Loading broadcast history...</span>
                  </td>
                </tr>
              ) : broadcasts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Send className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">No push broadcasts sent yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Compose a message above to notify your audience.
                    </p>
                  </td>
                </tr>
              ) : (
                broadcasts.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {b.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{b.body}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                        {b.targetAudience}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div>Targeted: {b.totalTargeted}</div>
                      <div className="text-emerald-600 dark:text-emerald-400">Sent: {b.totalSent}</div>
                      {b.totalFailed > 0 && (
                        <div className="text-red-500">Failed: {b.totalFailed}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {b.status === 'sent' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Sent
                        </span>
                      )}
                      {b.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          Failed
                        </span>
                      )}
                      {b.status === 'sending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          Sending
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                      {b.sentAt ? new Date(b.sentAt).toLocaleString() : 'N/A'}
                    </td>

                    <td className="py-3.5 px-4 text-right text-slate-500 text-[11px]">
                      {b.sentBy?.name || 'Admin'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

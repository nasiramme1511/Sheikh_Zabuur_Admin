import React from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import { AudioPreviewPlayer } from '@/components/player/AudioPreviewPlayer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioPlayerProvider>
      <div className="h-full flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-28">
            <div className="max-w-7xl mx-auto space-y-6">
              {children}
            </div>
          </main>
          <AudioPreviewPlayer />
        </div>
      </div>
    </AudioPlayerProvider>
  );
}

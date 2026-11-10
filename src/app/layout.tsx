import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sheikh Zabuur — Admin Platform',
  description: 'Enterprise Content Management Platform for Sheikh Zabuur Audio Library',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 dark:bg-slate-950 flex antialiased">
        {children}
      </body>
    </html>
  );
}

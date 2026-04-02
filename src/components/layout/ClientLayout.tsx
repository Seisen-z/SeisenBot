"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoaderCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Header from './Header';

const PUBLIC_PATHS = ['/login', '/auth', '/verify', '/'];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const guildIdMatch = pathname.match(/^\/dashboard\/(\d+)/);
  const guildId = guildIdMatch ? guildIdMatch[1] : null;
  const isPublicPath = PUBLIC_PATHS.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const hasCookie = /(^| )session_token=([^;]+)/.test(document.cookie);
      const fromSession = sessionStorage.getItem('seisenAuth') === '1';

      if (fromSession && hasCookie) {
        setIsAuthenticated(true);
        setAuthChecked(true);
        return;
      }

      if (fromSession && !hasCookie) {
        sessionStorage.removeItem('seisenAuth');
      }

      if (hasCookie) {
        sessionStorage.setItem('seisenAuth', '1');
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!authChecked || isPublicPath) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [authChecked, isAuthenticated, isPublicPath, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!isPublicPath && !authChecked) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="glass-card page-enter w-full max-w-lg rounded-3xl px-8 py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-discord-blurple/15 text-discord-blurple">
            <LoaderCircleIcon className="h-6 w-6 animate-spin" />
          </div>
          <h2 className="title-glow text-2xl font-bold text-white">Preparing Your Workspace</h2>
          <p className="mt-2 text-sm text-discord-text-muted">
            Checking your session and loading bot dashboard components.
          </p>
        </div>
      </main>
    );
  }

  if (isPublicPath) {
    return <main className="relative flex min-h-screen w-full justify-center">{children}</main>;
  }

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(45,196,183,0.08),_transparent_55%)]" />

      {guildId && (
        <>
          <button
            aria-label="Close sidebar"
            type="button"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden',
              sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          />

          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-40 w-[18rem] transform transition-transform duration-300 lg:static lg:z-10 lg:w-[18rem] lg:translate-x-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <Sidebar guildId={guildId} onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      <div className="relative z-10 flex min-h-screen w-full flex-col overflow-hidden">
        <Header
          showMenuButton={Boolean(guildId)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1520px]">
            {children}
          </div>
        </main>

        <div className="pointer-events-none mx-auto mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-discord-text-muted/80">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          Protected Seisen Control Plane
        </div>
      </div>
    </div>
  );
}

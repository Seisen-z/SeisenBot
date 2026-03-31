"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';

const PUBLIC_PATHS = ['/login', '/auth'];

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const guildIdMatch = pathname.match(/^\/dashboard\/(\d+)/);
  const guildId = guildIdMatch ? guildIdMatch[1] : null;
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  useEffect(() => {
    // Skip auth check on public pages
    if (isPublicPath) return;

    const token = getCookie('session_token');
    if (!token) {
      router.replace('/login');
    }
  }, [pathname, isPublicPath, router]);

  // Don't wrap login/auth pages with dashboard shell
  if (isPublicPath) {
    return <main className="flex h-full min-h-screen">{children}</main>;
  }

  // Server select page has its own layout
  if (pathname === '/') {
    return <main className="flex h-full min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-full">
      {guildId && <Sidebar guildId={guildId} />}
      <div className="flex w-full flex-col overflow-hidden">
        <Header activeGuildId={guildId} />
        <main className="flex-1 overflow-y-auto bg-discord-dark p-6">
          <div className="w-full max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

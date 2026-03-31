"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';

const PUBLIC_PATHS = ['/login', '/auth'];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const guildIdMatch = pathname.match(/^\/dashboard\/(\d+)/);
  const guildId = guildIdMatch ? guildIdMatch[1] : null;
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname === '/';
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check sessionStorage first (most reliable for client-side navigation),
    // then fall back to cookie parsing.
    const fromSession = sessionStorage.getItem('seisenAuth') === '1';
    if (fromSession) {
      setIsAuthenticated(true);
      setAuthChecked(true);
      return;
    }
    // Fallback: parse the cookie directly
    const cookieMatch = document.cookie.match(/(^| )session_token=([^;]+)/);
    if (cookieMatch) {
      // Repopulate sessionStorage to avoid repeating cookie parsing
      sessionStorage.setItem('seisenAuth', '1');
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
    setAuthChecked(true);
  }, []); // Only run once on first mount

  useEffect(() => {
    if (!authChecked || isPublicPath) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [authChecked, isAuthenticated, isPublicPath, router]);


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

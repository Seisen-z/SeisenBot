"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';

export default function ClientLayout({
  children,
  isAuthenticated
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
}) {
  const pathname = usePathname();
  const guildIdMatch = pathname.match(/^\/dashboard\/(\d+)/);
  const guildId = guildIdMatch ? guildIdMatch[1] : null;
  const isLandingPage = pathname === "/login" || pathname === "/";

  // Ensure unauthenticated users don't see the shell before redirection
  if (!isAuthenticated && !isLandingPage) {
    return <main className="flex h-full min-h-screen">{children}</main>;
  }

  // The landing pages (login & server select) are beautifully standalone now
  if (isLandingPage) {
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

"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoaderCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Header from './Header';

const PUBLIC_PATHS = ['/login', '/auth', '/'];
type AuthUser = {
  id?: string;
  username?: string;
  global_name?: string;
  avatar?: string | null;
};

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [hasGuildAccess, setHasGuildAccess] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) {
          const user = (await res.json().catch(() => null)) as AuthUser | null;
          setIsAuthenticated(true);
          setAuthUser(user);
          try {
            sessionStorage.setItem('seisenAuth', '1');
          } catch {
            /* ignore */
          }
        } else {
          setIsAuthenticated(false);
          setAuthUser(null);
          try {
            sessionStorage.removeItem('seisenAuth');
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          setAuthUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!authChecked || isPublicPath) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [authChecked, isAuthenticated, isPublicPath, router]);

  useEffect(() => {
    let cancelled = false;
    if (!guildId || isPublicPath || !isAuthenticated) {
      setHasGuildAccess(null);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/guilds_proxy', { cache: 'no-store', credentials: 'include' });
        if (!res.ok || cancelled) {
          if (!cancelled) setHasGuildAccess(null);
          return;
        }
        const guilds = (await res.json().catch(() => [])) as Array<{ id: string; owner?: boolean; permissions?: string; permissions_new?: string }>;
        if (!Array.isArray(guilds) || cancelled) return;

        const target = guilds.find((guild) => String(guild.id) === String(guildId));
        if (!target) {
          setHasGuildAccess(false);
          return;
        }
        if (target.owner) {
          setHasGuildAccess(true);
          return;
        }
        const permissionValue = String(target.permissions ?? target.permissions_new ?? '0');
        const perms = BigInt(permissionValue);
        const hasManageOrAdmin =
          (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);
        setHasGuildAccess(hasManageOrAdmin);
      } catch {
        if (!cancelled) setHasGuildAccess(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guildId, isAuthenticated, isPublicPath]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('seisenSidebarCollapsed');
      if (stored === '1') setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('seisenSidebarCollapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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
  const readOnlyMode = Boolean(guildId && hasGuildAccess === false);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(130,130,130,0.09),_transparent_54%)]" />
      <div className="relative z-10 flex h-full w-full overflow-hidden border-y border-white/10 bg-[rgba(10,10,12,0.78)] lg:border-y-0">

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
                'fixed inset-y-0 left-0 z-40 transform transition-all duration-300 lg:relative lg:inset-auto lg:h-full lg:translate-x-0',
                sidebarCollapsed ? 'w-[5.25rem] lg:w-[5.25rem]' : 'w-[17.5rem] lg:w-[17.5rem]',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              )}
            >
              <Sidebar
                guildId={guildId}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={toggleSidebarCollapsed}
                onNavigate={() => setSidebarOpen(false)}
                userDisplayName={authUser?.global_name || authUser?.username || 'Guest'}
                userSubtext={authUser?.id || 'N/A'}
                userAvatarUrl={
                  authUser?.id && authUser?.avatar
                    ? `https://cdn.discordapp.com/avatars/${authUser.id}/${authUser.avatar}.png?size=128`
                    : null
                }
              />
            </aside>
          </>
        )}

        <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            showMenuButton={Boolean(guildId)}
            onOpenSidebar={() => setSidebarOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebarCollapse={toggleSidebarCollapsed}
          />

          <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6 lg:px-7 lg:pt-5">
            <div className="mx-auto w-full max-w-[1620px]">
              {readOnlyMode && (
                <div className="mb-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Read-Only Mode</p>
                  <p className="mt-1 text-xs text-discord-text-muted">
                    You do not have Administrator or Manage Server in this guild. Editing is disabled.
                  </p>
                  <a
                    href="/"
                    className="mt-3 inline-flex h-9 items-center rounded-lg border border-white/15 px-3 text-xs font-semibold text-discord-text transition hover:border-white/35 hover:text-white"
                  >
                    Back to Server Selection
                  </a>
                </div>
              )}
              <div className={cn(readOnlyMode && "pointer-events-none select-text opacity-75")}>
                {children}
              </div>
            </div>
          </main>

          <div className="pointer-events-none mx-auto mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-discord-text-muted/75">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Protected Seisen Control Plane
          </div>
        </div>
      </div>
    </div>
  );
}

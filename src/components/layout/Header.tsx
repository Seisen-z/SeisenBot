"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellIcon, ChevronDownIcon, LoaderCircleIcon, LogOutIcon, MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";

export default function Header({
  showMenuButton,
  onOpenSidebar,
  sidebarCollapsed,
  onToggleSidebarCollapse,
}: {
  showMenuButton?: boolean;
  onOpenSidebar?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const guildId = useMemo(() => pathname.match(/^\/dashboard\/(\d+)/)?.[1] ?? null, [pathname]);
  const [guildMeta, setGuildMeta] = useState<{ id: string; name: string; icon: string | null } | null>(null);
  const [guildOptions, setGuildOptions] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);
  const [guildLoading, setGuildLoading] = useState(false);
  const [botLookupUnavailable, setBotLookupUnavailable] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  const currentGuildPrefix = useMemo(() => (guildId ? `/dashboard/${guildId}` : null), [guildId]);
  const canUseDropdown = Boolean(guildId);

  useEffect(() => {
    let cancelled = false;
    if (!guildId) {
      setGuildMeta(null);
      setGuildLoading(false);
      setBotLookupUnavailable(false);
      return;
    }
    setGuildLoading(true);

    (async () => {
      try {
        const [userGuildsRes, botGuildsRes] = await Promise.all([
          fetch("/api/guilds_proxy", { cache: "no-store", credentials: "include" }),
          fetch("/api/bot/guilds", { cache: "no-store", credentials: "include" }),
        ]);
        if (!userGuildsRes.ok || cancelled) {
          if (!cancelled) setGuildMeta(null);
          return;
        }
        const guilds = (await userGuildsRes.json().catch(() => [])) as Array<{ id: string; name: string; icon?: string | null }>;
        if (cancelled || !Array.isArray(guilds)) return;
        const mappedGuilds = guilds.map((guild: any) => ({
          id: String(guild.id),
          name: String(guild.name || "Server"),
          icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
          permissions: guild.permissions ?? guild.permissions_new ?? "0",
          owner: Boolean(guild.owner),
        }));
        const manageableGuilds = mappedGuilds.filter((guild) => {
          if (guild.owner) return true;
          try {
            const perms = BigInt(guild.permissions || "0");
            return (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);
          } catch {
            return false;
          }
        });

        // Strictly show shared guilds only: user guilds ∩ bot guilds.
        // If bot guilds cannot be fetched, fall back to manageable user guilds only.
        let visibleGuilds: Array<{ id: string; name: string; icon: string | null }> = [];
        let botLookupFailed = false;
        if (botGuildsRes.ok) {
          const botData = (await botGuildsRes.json().catch(() => null)) as { guild_ids?: string[] } | null;
          const botGuildIds = new Set((botData?.guild_ids || []).map((id) => String(id)));
          visibleGuilds = manageableGuilds.filter((guild) => botGuildIds.has(guild.id));
        } else {
          botLookupFailed = true;
          visibleGuilds = manageableGuilds;
        }

        setGuildOptions(visibleGuilds);
        setBotLookupUnavailable(botLookupFailed);
        const current = visibleGuilds.find((guild) => guild.id === String(guildId))
          || manageableGuilds.find((guild) => guild.id === String(guildId))
          || mappedGuilds.find((guild) => guild.id === String(guildId));
        if (!current) {
          setGuildMeta(null);
          return;
        }
        setGuildMeta(current);
      } catch {
        if (!cancelled) {
          setGuildMeta(null);
          setGuildOptions([]);
          setBotLookupUnavailable(true);
        }
      } finally {
        if (!cancelled) setGuildLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!switcherRef.current) return;
      if (!switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSwitchGuild = (nextGuildId: string) => {
    const suffix = currentGuildPrefix && pathname.startsWith(currentGuildPrefix)
      ? pathname.slice(currentGuildPrefix.length)
      : "";
    const nextPath = `/dashboard/${nextGuildId}${suffix || ""}`;
    setSwitcherOpen(false);
    router.push(nextPath);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgba(11,11,13,0.94)] px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-[rgba(18,18,20,0.96)] text-discord-text-muted transition hover:text-white lg:inline-flex"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpenIcon className="h-4.5 w-4.5" /> : <PanelLeftCloseIcon className="h-4.5 w-4.5" />}
          </button>
          {showMenuButton && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-[rgba(18,18,20,0.96)] text-discord-text transition hover:bg-[rgba(28,28,31,0.96)] lg:hidden"
              aria-label="Open sidebar"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          )}

          <div ref={switcherRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => {
                if (canUseDropdown) {
                  setSwitcherOpen((prev) => !prev);
                } else {
                  router.push("/");
                }
              }}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[rgba(18,18,20,0.86)] px-3 py-2 transition hover:border-white/30"
              title="Switch server"
              aria-busy={guildLoading}
              aria-expanded={switcherOpen}
            >
            <div className="h-8 w-8 overflow-hidden rounded-lg ring-1 ring-white/15">
              {guildLoading ? (
                <div className="flex h-full w-full items-center justify-center bg-[#1a1b21] text-discord-text-muted">
                  <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                </div>
              ) : guildMeta?.icon ? (
                <img src={guildMeta.icon} alt={guildMeta.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#1a1b21] text-xs font-bold text-white">
                  {(guildMeta?.name || "S").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="max-w-[180px] truncate text-sm font-semibold text-white">
                {guildLoading ? "Loading server..." : guildMeta?.name || "Unknown Server"}
              </p>
              <p className="text-[11px] text-discord-text-muted">Switch server</p>
            </div>
            <ChevronDownIcon className={`h-3.5 w-3.5 text-discord-text-muted transition group-hover:text-white ${switcherOpen ? "rotate-180" : ""}`} />
            <div className={guildLoading ? "h-2 w-2 rounded-full bg-white/35" : "h-2 w-2 rounded-full bg-white/70"} />
            </button>
            {canUseDropdown && switcherOpen && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-xl border border-white/12 bg-[#121317] shadow-2xl">
                <div className="max-h-[340px] overflow-y-auto p-2">
                  {guildOptions.map((guild) => {
                    const active = guild.id === guildId;
                    return (
                      <button
                        key={guild.id}
                        type="button"
                        onClick={() => handleSwitchGuild(guild.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                          active ? "bg-white/12 text-white" : "text-discord-text-muted hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <div className="h-8 w-8 overflow-hidden rounded-md ring-1 ring-white/15">
                          {guild.icon ? (
                            <img src={guild.icon} alt={guild.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#1a1b21] text-xs font-bold text-white">
                              {guild.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="truncate text-sm">{guild.name}</span>
                      </button>
                    );
                  })}
                  {guildOptions.length === 0 && (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-discord-text-muted">
                      {botLookupUnavailable
                        ? "Bot server unavailable. Showing your manageable servers."
                        : "No shared servers with bot found."}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false);
                    router.push("/");
                  }}
                  className="w-full border-t border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-discord-text-muted transition hover:bg-white/8 hover:text-white"
                >
                  Open server selection page
                </button>
              </div>
            )}
          </div>
          <Link
            href="/"
            className="group inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[rgba(18,18,20,0.86)] text-discord-text-muted transition hover:border-white/30 hover:text-white sm:hidden"
            title="Switch server"
            aria-label="Switch server"
          >
            {guildMeta?.icon ? (
              <img src={guildMeta.icon} alt={guildMeta.name} className="h-6 w-6 rounded-md object-cover" />
            ) : guildLoading ? (
              <LoaderCircleIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </Link>

        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[rgba(18,18,20,0.86)] text-discord-text-muted transition hover:text-white"
            aria-label="Notifications"
          >
            <BellIcon className="h-4 w-4" />
          </button>
          <a
            href="/api/auth/discord/logout"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-[rgba(18,18,20,0.96)] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-discord-text transition hover:border-white/35 hover:bg-white/10 hover:text-white"
          >
            <LogOutIcon className="h-4 w-4" />
            Logout
          </a>
        </div>
      </div>
    </header>
  );
}

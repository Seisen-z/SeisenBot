import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  LogOutIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Keep short-lived response data during navigation and render bursts.
const HOME_CACHE_TTL_MS = 20_000;
const _profileCache = new Map<string, { user: any; guilds: any[]; expiresAt: number }>();

function tokenCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resolveServerApiBase(): string {
  let raw = process.env.BOT_API_URL || process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "https://seisenbot.wisp.uno";
  raw = raw.trim().replace(/\/+$/, "");
  if (raw.startsWith("http://") && !raw.includes("localhost") && !raw.includes("127.0.0.1")) {
    raw = raw.replace(/^http:\/\//i, "https://");
  }
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const SERVER_API_BASE = resolveServerApiBase();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

/** Moderation-oriented bot invite (no Administrator / 8): Manage Server, roles, channels, kick, ban, moderate, messages, nicknames, core messaging permissions. */
const MOD_BOT_PERMISSIONS = "1099914670390";

function decodeCookieToken(value: string | undefined) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getInviteUrl(guildId: string) {
  if (!DISCORD_CLIENT_ID) return null;

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    permissions: MOD_BOT_PERMISSIONS,
    scope: "bot applications.commands",
    guild_id: guildId,
    disable_guild_select: "true",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = decodeCookieToken(cookieStore.get("session_token")?.value);

  if (!token) redirect("/login");

  const cacheKey = tokenCacheKey(token);
  const now = Date.now();

  let user: any = null;
  let guilds: any[] = [];
  let botGuildIds: Set<string> = new Set();
  let botGuildLookupAvailable = false;
  let requiresReauth = false;

  const cachedProfile = _profileCache.get(cacheKey);
  if (cachedProfile && cachedProfile.expiresAt > now) {
    user = cachedProfile.user;
    guilds = cachedProfile.guilds;
  } else {
    try {
      const [resUser, resDashboardGuilds] = await Promise.all([
        fetch("https://discord.com/api/users/@me", {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "SeisenHubDashboard/1.0",
          },
        }),
        fetch(`${SERVER_API_BASE.replace(/\/api$/, '')}/api/bot/dashboard-guilds`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "SeisenHubDashboard/1.0",
          },
          cache: "no-store",
        }),
      ]);

      // ONLY require re-auth if Discord itself says the access token is invalid (401).
      // Never boot the user to /login?error=auth_failed if Discord accepted the user token!
      if (resUser.status === 401) {
        requiresReauth = true;
      }

      if (resUser.ok) user = await resUser.json();
      const dashboardGuildData = resDashboardGuilds.ok ? await resDashboardGuilds.json() : null;
      if (Array.isArray(dashboardGuildData?.guilds)) guilds = dashboardGuildData.guilds;
      if (Array.isArray(dashboardGuildData?.bot_guild_ids)) {
        botGuildIds = new Set(dashboardGuildData.bot_guild_ids);
        botGuildLookupAvailable = true;
      }

      // Fallback: If bot API call failed/empty but user token is valid, fetch user's guilds directly from Discord API
      if (guilds.length === 0 && resUser.ok) {
        try {
          const resDirectGuilds = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: {
              Authorization: `Bearer ${token}`,
              "User-Agent": "SeisenHubDashboard/1.0",
            },
          });
          if (resDirectGuilds.ok) {
            const rawGuilds = await resDirectGuilds.json();
            if (Array.isArray(rawGuilds)) guilds = rawGuilds;
          }
        } catch {
          /* ignore */
        }
      }

      if (resUser.ok && guilds.length > 0) {
        _profileCache.set(cacheKey, { user, guilds, expiresAt: now + HOME_CACHE_TTL_MS });
      } else if (!requiresReauth && cachedProfile) {
        user = cachedProfile.user;
        guilds = cachedProfile.guilds;
      }
    } catch {
      if (cachedProfile) {
        user = cachedProfile.user;
        guilds = cachedProfile.guilds;
      }
    }
  }

  if (requiresReauth) {
    redirect("/login?error=auth_failed");
  }

  const adminGuilds = guilds.filter((g: any) => {
    if (g.owner) return true;

    const permissionValue = g.permissions ?? g.permissions_new ?? "0";
    const perms = BigInt(permissionValue);
    return (
      (perms & BigInt(0x8)) === BigInt(0x8) ||
      (perms & BigInt(0x20)) === BigInt(0x20)
    );
  });

  const sortedGuilds = [...adminGuilds].sort(
    (a, b) => (botGuildIds.has(b.id) ? 1 : 0) - (botGuildIds.has(a.id) ? 1 : 0)
  );

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : null;

  const displayName = user?.global_name || user?.username || "Unknown";
  const connectedGuildCount = botGuildLookupAvailable
    ? sortedGuilds.filter((g) => botGuildIds.has(g.id)).length
    : 0;

  return (
    <div className="relative min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 page-enter">
        <header className="glass-card flex flex-col gap-4 rounded-3xl px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#a3a7b0] via-[#878b94] to-[#686c75] text-sm font-black text-white shadow-[0_10px_24px_rgba(18,20,24,0.45)]">
              S
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-discord-text-muted">Seisen Control</p>
              <h1 className="truncate text-2xl font-bold text-white">Choose a Server Workspace</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-[rgba(20,24,34,0.8)] px-3 py-2">
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-discord-blurple text-xs font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs text-discord-text-muted">Signed in as</p>
                  <p className="max-w-[150px] truncate text-sm font-semibold text-white">{displayName}</p>
                </div>
              </div>
            </div>

            <a
              href="/api/auth/discord/logout"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[rgba(22,27,38,0.92)] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-discord-text transition hover:border-discord-red/40 hover:bg-discord-red/20 hover:text-white"
            >
              <LogOutIcon className="h-4 w-4" />
              Logout
            </a>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-card rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Available Servers</h2>
                <p className="text-sm text-discord-text-muted">Only servers where you can manage configuration are shown.</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90">
                {botGuildLookupAvailable ? `${connectedGuildCount} active with bot` : "bot status unavailable"}
              </div>
            </div>

            {sortedGuilds.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[rgba(20,24,34,0.7)] px-5 py-12 text-center">
                <AlertCircleIcon className="h-10 w-10 text-discord-red/80" />
                <p className="text-base font-semibold text-white">No eligible servers found.</p>
                <p className="max-w-sm text-sm text-discord-text-muted">
                  You need Administrator or Manage Server permission on a mutual Discord server to continue.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {sortedGuilds.map((guild: any) => {
                  // Keep server selection usable if bot-status lookup is temporarily unavailable.
                  const botHere = !botGuildLookupAvailable || botGuildIds.has(guild.id);
                  const iconUrl = guild.icon
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                    : null;
                  const inviteUrl = getInviteUrl(guild.id);

                  if (botHere) {
                    return (
                      <Link
                        key={guild.id}
                        href={`/dashboard/${guild.id}`}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(20,24,34,0.8)] px-4 py-3 transition hover:border-discord-blurple/45 hover:bg-[rgba(27,32,44,0.92)]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-discord-blurple/40">
                            {iconUrl ? (
                              <img src={iconUrl} alt={guild.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-discord-blurple text-sm font-black text-white">
                                {guild.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{guild.name}</p>
                            <p className="text-xs text-discord-text-muted">Open dashboard workspace</p>
                          </div>
                        </div>
                        <span className="rounded-lg border border-discord-blurple/35 bg-discord-blurple/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-discord-blurple">
                          Manage
                        </span>
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={guild.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(16,20,29,0.82)] px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3 opacity-80">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20 grayscale">
                          {iconUrl ? (
                            <img src={iconUrl} alt={guild.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[rgba(35,44,62,0.95)] text-sm font-bold text-white">
                              {guild.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white/85">{guild.name}</p>
                          <p className="text-xs text-discord-text-muted">Bot not added yet</p>
                        </div>
                      </div>

                      {inviteUrl ? (
                        <a
                          href={inviteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[rgba(21,26,37,0.95)] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-discord-text transition hover:border-discord-blurple/45 hover:text-white"
                        >
                          Invite
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-discord-text-muted">Set DISCORD_CLIENT_ID to enable invites</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="glass-card rounded-3xl p-5">
              <div className="mb-2 flex items-center gap-2 text-discord-blurple">
                <SparklesIcon className="h-4 w-4" />
                <p className="text-xs font-bold uppercase tracking-[0.14em]">Workspace Snapshot</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[rgba(20,24,34,0.78)] p-3">
                  <p className="text-xs text-discord-text-muted">Servers You Can Manage</p>
                  <p className="text-2xl font-bold text-white">{sortedGuilds.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[rgba(20,24,34,0.78)] p-3">
                  <p className="text-xs text-discord-text-muted">Servers With Bot Active</p>
                  <p className="text-2xl font-bold text-white">{connectedGuildCount}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-5">
              <div className="mb-2 flex items-center gap-2 text-discord-green">
                <ShieldCheckIcon className="h-4 w-4" />
                <p className="text-xs font-bold uppercase tracking-[0.14em]">Session Health</p>
              </div>
              <p className="text-sm text-discord-text-muted">
                Your session is active. If guilds stop loading, refresh OAuth from the login page to renew your token.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

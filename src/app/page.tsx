import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  LogOutIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";

const SERVER_API_BASE = process.env.API_PROXY_TARGET
  ? `${process.env.API_PROXY_TARGET}/api`
  : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

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
    permissions: "8",
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

  let user: any = null;
  let guilds: any[] = [];
  let botGuildIds: Set<string> = new Set();
  let botFeatureAvailable = false;
  let requiresReauth = false;

  try {
    const [resUser, resGuilds] = await Promise.all([
      fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 60 },
      }),
    ]);

    if (resUser.status === 401 || resGuilds.status === 401) {
      requiresReauth = true;
    }

    if (resUser.ok) user = await resUser.json();
    if (resGuilds.ok) guilds = await resGuilds.json();

    if ((!resUser.ok || !resGuilds.ok) && !requiresReauth && process.env.NODE_ENV === "development") {
      console.info("Discord profile/guild fetch non-auth failure", {
        userStatus: resUser.status,
        guildStatus: resGuilds.status,
      });
    }
  } catch {
    // Network/transient issues are handled by fallback UI and login flow.
  }

  if (requiresReauth) {
    redirect("/login?error=auth_failed");
  }

  try {
    const resBotGuilds = await fetch(`${SERVER_API_BASE.replace(/\/api$/, '')}/api/bot/guilds`, {
      next: { revalidate: 60 },
    });

    if (resBotGuilds.ok) {
      const botData = await resBotGuilds.json();
      botGuildIds = new Set(botData.guild_ids || []);
      botFeatureAvailable = botGuildIds.size > 0;
    }
  } catch {
    // Bot API may be unavailable in local/dev deployments.
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
  const connectedGuildCount = sortedGuilds.filter((g) => !botFeatureAvailable || botGuildIds.has(g.id)).length;

  return (
    <div className="relative min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 page-enter">
        <header className="glass-card flex flex-col gap-4 rounded-3xl px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-discord-blurple via-[#49c5df] to-[#4f8ff7] text-sm font-black text-white shadow-[0_10px_24px_rgba(45,196,183,0.35)]">
              S
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-discord-text-muted">Seisen Control</p>
              <h1 className="truncate text-2xl font-bold text-white">Choose a Server Workspace</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-[#0f1b2a]/80 px-3 py-2">
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
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#122033] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-discord-text transition hover:border-discord-red/40 hover:bg-discord-red/20 hover:text-white"
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
              <div className="rounded-xl border border-discord-green/30 bg-discord-green/12 px-3 py-2 text-xs font-semibold text-[#8ef2ca]">
                {connectedGuildCount} active with bot
              </div>
            </div>

            {sortedGuilds.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#0f1b2a]/65 px-5 py-12 text-center">
                <AlertCircleIcon className="h-10 w-10 text-discord-red/80" />
                <p className="text-base font-semibold text-white">No eligible servers found.</p>
                <p className="max-w-sm text-sm text-discord-text-muted">
                  You need Administrator or Manage Server permission on a mutual Discord server to continue.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {sortedGuilds.map((guild: any) => {
                  const botHere = !botFeatureAvailable || botGuildIds.has(guild.id);
                  const iconUrl = guild.icon
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                    : null;
                  const inviteUrl = getInviteUrl(guild.id);

                  if (botHere) {
                    return (
                      <Link
                        key={guild.id}
                        href={`/dashboard/${guild.id}/autoreply`}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0f1b2a]/75 px-4 py-3 transition hover:border-discord-blurple/45 hover:bg-[#152337]"
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
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0d1724]/80 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3 opacity-80">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20 grayscale">
                          {iconUrl ? (
                            <img src={iconUrl} alt={guild.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#20344c] text-sm font-bold text-white">
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
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#132234] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-discord-text transition hover:border-discord-blurple/45 hover:text-white"
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
                <div className="rounded-2xl border border-white/10 bg-[#0f1b2a]/75 p-3">
                  <p className="text-xs text-discord-text-muted">Servers You Can Manage</p>
                  <p className="text-2xl font-bold text-white">{sortedGuilds.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0f1b2a]/75 p-3">
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

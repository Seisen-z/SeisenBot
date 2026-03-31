import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AlertCircle, ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { HexagonBackground } from "@/components/ui/hexagon-background";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:20934";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) redirect("/login");

  let user: any = null;
  let guilds: any[] = [];
  let botGuildIds: Set<string> = new Set();

  let botFeatureAvailable = false;

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

    if (resUser.ok) user = await resUser.json();
    if (resGuilds.ok) guilds = await resGuilds.json();
    else if (resGuilds.status === 401) redirect("/api/auth/discord/logout");
  } catch (err) {
    console.error("Failed to fetch Discord data", err);
  }

  // Fetch bot guilds separately — feature gracefully degrades if API not deployed yet
  try {
    const resBotGuilds = await fetch(`${API_BASE}/bot/guilds`, {
      next: { revalidate: 60 },
    });
    if (resBotGuilds.ok) {
      const botData = await resBotGuilds.json();
      botGuildIds = new Set(botData.guild_ids || []);
      botFeatureAvailable = botGuildIds.size > 0;
    }
  } catch {
    // Endpoint not yet deployed — show all servers normally
  }

  const adminGuilds = guilds.filter((g: any) => {
    const perms = BigInt(g.permissions);
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

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-4">
      <HexagonBackground />

      {/* ── Brand ── */}
      <div className="z-10 mb-8 flex flex-col items-center gap-3 select-none">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#5865F2]/20 blur-2xl" />
          <div
            className="h-12 w-12 flex items-center justify-center"
            style={{
              background: "linear-gradient(145deg, #7289da 0%, #5865F2 60%, #4752C4 100%)",
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              boxShadow: "0 0 28px rgba(88,101,242,0.50)",
            }}
          >
            <span className="text-white font-black text-lg">S</span>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-white">Seisen Hub</h1>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#5865F2]/50 mt-0.5">
            Dashboard
          </p>
        </div>
      </div>

      {/* ── Server Card ── */}
      <div className="z-10 w-full max-w-[460px]">
        <div
          className="relative rounded-2xl p-px"
          style={{
            background:
              "linear-gradient(145deg, rgba(88,101,242,0.30) 0%, rgba(71,82,196,0.10) 55%, rgba(0,0,0,0) 100%)",
          }}
        >
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "linear-gradient(160deg, rgba(18,20,31,0.97) 0%, rgba(10,11,16,0.99) 100%)",
              backdropFilter: "blur(28px)",
            }}
          >
            {/* ── Logged-in header ── */}
            <div className="flex items-center justify-center gap-2 border-b border-white/[0.04] bg-white/[0.015] px-6 py-4">
              <span className="text-xs font-medium text-[#5a5f78]">Logged in as</span>
              <div className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/[0.04] cursor-pointer transition-colors">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-6 w-6 rounded-full ring-1 ring-white/10"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-[#5865F2] flex items-center justify-center text-[10px] font-black text-white">
                    {(user?.global_name || user?.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-bold text-white">
                  {user?.global_name || user?.username || "Unknown"}
                </span>
                <ChevronDownIcon className="h-3.5 w-3.5 text-[#5a5f78]" />
              </div>
            </div>

            {/* ── Server list ── */}
            <div className="flex max-h-[52vh] min-h-[280px] flex-col overflow-y-auto px-3 py-3">
              {sortedGuilds.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
                  <AlertCircle className="h-10 w-10 text-red-400/50" />
                  <p className="text-sm font-semibold text-[#5a5f78]">No eligible servers found.</p>
                  <p className="text-xs text-[#3a3f52] max-w-[240px]">
                    You need Administrator or Manage Server permissions in a mutual server.
                  </p>
                </div>
              ) : (
                sortedGuilds.map((guild: any) => {
                  const botHere = !botFeatureAvailable || botGuildIds.has(guild.id);
                  const iconUrl = guild.icon
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                    : null;

                  if (botHere) {
                    // ── Active server (bot is here) ──
                    return (
                      <a
                        key={guild.id}
                        href={`/dashboard/${guild.id}/autoreply`}
                        className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[#5865F2]/[0.08] transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-[#5865F2]/40 shadow-[0_0_12px_rgba(88,101,242,0.2)]">
                            {iconUrl ? (
                              <img src={iconUrl} alt={guild.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-[#5865F2] text-sm font-black text-white">
                                {guild.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="text-[15px] font-bold text-white">
                            {guild.name}
                          </span>
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-[#5865F2]/50 group-hover:text-[#5865F2] group-hover:translate-x-0.5 transition-all duration-200" />
                      </a>
                    );
                  }

                  // ── Inactive server (bot not here) ──
                  return (
                    <div
                      key={guild.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 opacity-40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/[0.06] grayscale">
                          {iconUrl ? (
                            <img src={iconUrl} alt={guild.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-[#3a3f52] text-sm font-bold text-white/50">
                              {guild.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-[14px] font-medium text-[#6b7280]">
                          {guild.name}
                        </span>
                      </div>
                      <PlusIcon className="h-4 w-4 text-[#6b7280]" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="absolute bottom-6 z-10 flex items-center gap-4 text-[11px] text-[#2e3248] select-none">
        <span>© 2021–2026 Seisen</span>
        <span>·</span>
        <span className="cursor-pointer hover:text-[#5865F2]/70 transition-colors">Terms</span>
        <span>·</span>
        <span className="cursor-pointer hover:text-[#5865F2]/70 transition-colors">Privacy</span>
        <span>·</span>
        <span className="cursor-pointer hover:text-[#5865F2]/70 transition-colors">Legal Notice</span>
      </div>
    </div>
  );
}

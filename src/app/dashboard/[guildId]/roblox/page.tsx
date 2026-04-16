"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { DiscordMessagePreview } from "@/components/ui/discord-message";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { Trash2Icon, PlusIcon, GamepadIcon } from "lucide-react";

interface RobloxMonitor {
  name?: string;
  universe_id: string;
  channel_id: string;
  role_id: string;
  last_updated: string | null;
}

interface GameInfo {
  name: string;
  playing: number;
  visits: number;
  thumbnail_url: string;
}

interface RobloxMonitorHealth {
  monitor_count: number;
  loop_healthy: boolean;
  is_stale: boolean;
  age_seconds: number | null;
  loop_started_at: string | null;
  last_poll_started: string | null;
  last_poll_finished: string | null;
  last_poll_seconds: number | null;
  last_notifications: number;
  last_error: string | null;
}

export default function RobloxMonitorsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  
  const [monitors, setMonitors] = useState<RobloxMonitor[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [gameInfos, setGameInfos] = useState<Record<string, GameInfo>>({});
  
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [forcing, setForcing] = useState(false);
  const [loadingGames, setLoadingGames] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [monitorHealth, setMonitorHealth] = useState<RobloxMonitorHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadMonitorHealth = async (silent = false) => {
      try {
        const health = await fetchApi(`/guilds/${guildId}/roblox/health`);
        if (mounted) setMonitorHealth(health as RobloxMonitorHealth);
      } catch {
        if (!silent && mounted) {
          toast("Failed to load Roblox monitor status", "error");
        }
      } finally {
        if (mounted) setHealthLoading(false);
      }
    };

    fetchApi(`/guilds/${guildId}/roblox`)
      .then((data: RobloxMonitor[]) => {
        const mods = data || [];
        setMonitors(mods);
        if (mods.length > 0) setActiveIdx(0);
        
        // Fetch info for all existing monitors
        mods.forEach(m => {
          if (m.universe_id) fetchGameInfo(m.universe_id);
        });
      })
      .catch(() => toast("Failed to load Roblox monitors", "error"))
      .finally(() => {
        if (mounted) setInitialLoadComplete(true);
      });

    loadMonitorHealth(true);
    const healthTimer = window.setInterval(() => {
      loadMonitorHealth(true);
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(healthTimer);
    };
  }, [guildId, toast]);

  const persistMonitors = useCallback(async (nextMonitors: RobloxMonitor[]) => {
    await fetchApi(`/guilds/${guildId}/roblox`, undefined, {
      method: "PUT",
      body: JSON.stringify(
        nextMonitors.map(m => ({
          name: m.name || null,
          universe_id: m.universe_id ? String(m.universe_id) : null,
          channel_id: m.channel_id ? String(m.channel_id) : null,
          role_id: m.role_id ? String(m.role_id) : null,
          last_updated: m.last_updated || null
        }))
      ),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: monitors,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1500,
    onSave: persistMonitors,
    onError: (err: any) => toast(err?.message || "Auto-save failed for Roblox monitors", "error"),
  });

  const fetchGameInfo = async (uid: string) => {
    if (!uid || gameInfos[uid] || loadingGames[uid]) return;
    
    setLoadingGames(prev => ({ ...prev, [uid]: true }));
    try {
      const data = await fetchApi(`/roblox/${uid}`);
      setGameInfos(prev => ({ ...prev, [uid]: data }));
    } catch (err) {
      // Silently fail, just means we can't find it or API limit
    } finally {
      setLoadingGames(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistMonitors(monitors);
      toast("Roblox Monitors Saved Successfully!");
    } catch (e: any) {
        toast(e?.message || "Failed to save.", "error");
      } finally {
      setSaving(false);
    }
  };

  const handleForceCheck = async () => {
    const monitor = monitors[activeIdx];
    if (!monitor || !monitor.universe_id || !monitor.channel_id) {
       toast("Monitor must have a Universe ID and Channel selected.", "error");
       return;
    }
    setForcing(true);
    try {
      await fetchApi('/trigger/roblox', undefined, {
        method: "POST",
        body: JSON.stringify({ 
          guild_id: guildId, 
          payload: { 
            universe_id: monitor.universe_id, 
            channel_id: monitor.channel_id,
            role_id: monitor.role_id || null,
          } 
        })
      });

      try {
        const health = await fetchApi(`/guilds/${guildId}/roblox/health`);
        setMonitorHealth(health as RobloxMonitorHealth);
      } catch {
        // Ignore health refresh errors after force check.
      }

      toast("Requested force check successfully!");
    } catch (err: any) {
      toast(`Error forcing check: ${err.message}`, "error");
    } finally {
      setForcing(false);
    }
  };

  const updateMonitor = (key: keyof RobloxMonitor, val: string) => {
    const newM = [...monitors];
    newM[activeIdx] = { ...newM[activeIdx], [key]: val };
    setMonitors(newM);
  };

  const activeMonitor = monitors[activeIdx];
  const activeGameInfo = activeMonitor?.universe_id ? gameInfos[activeMonitor.universe_id] : null;

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "Never";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleString();
  };

  const formatAge = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return "N/A";
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m ago`;
  };

  const statusLabel = healthLoading
    ? "Checking"
    : monitorHealth?.loop_healthy
      ? "Healthy"
      : monitorHealth?.last_error
        ? "Error"
        : "Stale";

  const statusDotClass = healthLoading
    ? "bg-slate-400"
    : monitorHealth?.loop_healthy
      ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.75)]"
      : monitorHealth?.last_error
        ? "bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.75)]"
        : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.75)]";

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Roblox Game Monitors</h1>
        <div className="flex items-center gap-3">
          {lastSaved && !saving && (
            <span className="text-xs text-green-400">
              Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
            </span>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Monitors"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[#1E1F22] bg-[#202225]/80 p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
            <span className="font-semibold text-white">Monitor Loop: {statusLabel}</span>
          </div>
          <span className="text-discord-text-muted">Last Poll: {formatDateTime(monitorHealth?.last_poll_finished)}</span>
          <span className="text-discord-text-muted">Age: {formatAge(monitorHealth?.age_seconds)}</span>
          <span className="text-discord-text-muted">Duration: {monitorHealth?.last_poll_seconds ?? "N/A"}s</span>
          <span className="text-discord-text-muted">Notifications: {monitorHealth?.last_notifications ?? 0}</span>
          <span className="text-discord-text-muted">Monitors: {monitorHealth?.monitor_count ?? monitors.length}</span>
        </div>
        {monitorHealth?.last_error && (
          <p className="mt-2 text-xs text-rose-300">Last Loop Error: {monitorHealth.last_error}</p>
        )}
      </div>

      <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Monitors</span>
            <button
              onClick={() => {
                setMonitors([...monitors, { name: "", universe_id: "", channel_id: "", role_id: "", last_updated: null }]);
                setActiveIdx(monitors.length);
              }}
              className="flex items-center gap-1 text-xs text-discord-text-muted hover:text-white bg-[#1E1F22] hover:bg-discord-blurple rounded-md px-2 py-1 transition"
            >
              <PlusIcon className="w-3 h-3" /> Add
            </button>
          </div>

          {monitors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-60">
              <GamepadIcon className="w-8 h-8 mb-2 text-discord-text-muted" />
              <p className="text-xs text-discord-text-muted">No monitors setup.<br/>Click Add to begin.</p>
            </div>
          )}

          {monitors.map((m, idx) => {
            const hasId = !!m.universe_id;
            const info = hasId ? gameInfos[m.universe_id] : null;
            const displayName = m.name || info?.name || (hasId ? `Universe: ${m.universe_id}` : "Empty Monitor");
            
            return (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md transition-colors truncate ${
                  activeIdx === idx 
                    ? 'bg-discord-blurple text-white font-medium shadow-sm' 
                    : 'text-discord-text hover:bg-[#383A40]'
                }`}
              >
                {info?.thumbnail_url ? (
                  <img src={info.thumbnail_url} alt="" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                ) : (
                  <GamepadIcon className={`w-5 h-5 shrink-0 ${activeIdx === idx ? 'text-white/80' : 'text-discord-text-muted/60'}`} />
                )}
                <span className="truncate flex-1">{displayName}</span>
              </button>
            );
          })}
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 relative overflow-y-auto">
            {activeMonitor ? (
              <div className="flex flex-col gap-6 h-full">
                <div className="flex justify-between items-start border-b border-[#1E1F22] pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                       {activeMonitor.name || activeGameInfo?.name || "Monitor"}
                    </h2>
                    <p className="text-sm text-discord-text-muted mt-1">
                      Bot will check every 5 minutes and ping when the game updates.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="discord" 
                      onClick={handleForceCheck} 
                      disabled={forcing || !activeMonitor.universe_id || !activeMonitor.channel_id} 
                      size="sm"
                    >
                      {forcing ? "Checking..." : "🚀 Force Check Now"}
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-[#1E1F22] pb-4 mb-2">
                  <button
                    onClick={() => setMode("edit")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      mode === "edit"
                        ? "bg-[#383A40] text-white"
                        : "text-discord-text-muted hover:bg-[#383A40] hover:text-white"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setMode("preview")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      mode === "preview"
                        ? "bg-[#383A40] text-white"
                        : "text-discord-text-muted hover:bg-[#383A40] hover:text-white"
                    }`}
                  >
                    Preview
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                  {mode === "edit" ? (
                    <div className="flex flex-col gap-4 max-w-2xl">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Monitor Custom Name (Optional)</label>
                        <input
                          type="text"
                          className="flex h-10 w-full rounded-md border border-discord-darkest bg-discord-darkest px-3 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                          value={activeMonitor.name || ""}
                          onChange={(e) => updateMonitor("name", e.target.value)}
                          placeholder="e.g. My Favorite Game"
                        />
                        <p className="text-xs text-discord-text-muted/60 mt-1.5 ml-1">
                          Give this monitor a nickname to help you identify it in the sidebar.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-[#1E1F22]">
                        <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Universe ID (numbers only)</label>
                        <input
                          type="text"
                          className="flex h-10 w-full rounded-md border border-discord-darkest bg-discord-darkest px-3 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                          value={activeMonitor.universe_id || ""}
                          onChange={(e) => updateMonitor("universe_id", e.target.value.replace(/[^0-9]/g, ''))}
                          onBlur={() => {
                            if (activeMonitor.universe_id) fetchGameInfo(activeMonitor.universe_id);
                          }}
                          placeholder="e.g. 5098664031"
                        />
                        <p className="text-xs text-discord-text-muted/60 mt-1.5 ml-1">
                          Find this on the creator dashboard, or use a Chrome extension. Unfocus to load game data.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-[#1E1F22]">
                        <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Notification Channel</label>
                        <ChannelSelect
                          guildId={guildId}
                          value={activeMonitor.channel_id || ""}
                          onChange={(id) => updateMonitor("channel_id", id)}
                          placeholder="Post updates in..."
                        />
                      </div>

                      <div className="pt-4 border-t border-[#1E1F22]">
                        <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Ping Role</label>
                        <RoleSelect
                          guildId={guildId}
                          value={activeMonitor.role_id || ""}
                          onChange={(id) => updateMonitor("role_id", id)}
                          placeholder="No role ping..."
                        />
                      </div>

                      <div className="mt-6 pt-4 border-t border-[#1E1F22]">
                        <Button 
                          variant="ghost" 
                          className="text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full justify-start"
                          onClick={() => {
                            const newM = monitors.filter((_, i) => i !== activeIdx);
                            setMonitors(newM);
                            setActiveIdx(newM.length > 0 ? 0 : -1);
                          }}
                        >
                          <Trash2Icon className="w-4 h-4 mr-2" /> Delete Monitor
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-w-md mx-auto">
                      <div className="bg-[#313338] rounded-xl border border-[#1E1F22] p-4 shadow-inner flex flex-col justify-center min-h-[250px]">
                        <DiscordMessagePreview
                          botName="Seisen Bot"
                          timestamp="Today at 12:48 PM"
                          content={activeMonitor.role_id ? `<@&${activeMonitor.role_id}>` : undefined}
                          title={activeGameInfo ? `🔔 ${activeGameInfo.name} — Game Updated!` : "🔔 Game Updated!"}
                          url={activeMonitor.universe_id ? `https://roblox.com/games/${activeMonitor.universe_id}` : undefined}
                          description={`🕹️ **Game**\n${activeGameInfo?.name || "Target Game"}\n\n📊 **Playing**\n${(activeGameInfo?.playing || 0).toLocaleString()}\n\n👍 **Visits**\n${(activeGameInfo?.visits || 0).toLocaleString()}`}
                          thumbnailUrl={activeGameInfo?.thumbnail_url}
                          color="#f47fff"
                          footerText="Roblox Game Monitor"
                          authorIcon="https://cdn.discordapp.com/avatars/1317544078518554655/49605d3c2eb11ef0dcdebcaf17cfebf3.png"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-discord-text-muted flex h-full flex-col items-center justify-center gap-3">
                <GamepadIcon className="w-12 h-12 opacity-20" />
                <p className="text-sm">Select a monitor or create a new one to begin.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setMonitors([...monitors, { name: "", universe_id: "", channel_id: "", role_id: "", last_updated: null }]);
                    setActiveIdx(monitors.length);
                  }}
                >
                  <PlusIcon className="w-4 h-4 mr-1" /> New Monitor
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

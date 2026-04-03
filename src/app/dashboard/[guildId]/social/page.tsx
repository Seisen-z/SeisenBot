"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { BellRingIcon, PlusIcon, RssIcon, Trash2Icon } from "lucide-react";

type SocialPlatform = "youtube" | "tiktok" | "rss";

interface SocialMonitor {
  name?: string | null;
  platform: SocialPlatform;
  source: string;
  feed_url?: string | null;
  channel_id?: string | null;
  role_id?: string | null;
  enabled: boolean;
  last_entry_id?: string | null;
  last_checked_at?: string | null;
  last_posted_at?: string | null;
  last_error?: string | null;
}

interface SocialHealth {
  guild_monitor_count: number;
  enabled_monitor_count: number;
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

interface SocialTestResult {
  status: string;
  checked_at: string;
  resolved_feed_url: string;
  latest_entry?: {
    id?: string | null;
    title?: string | null;
    author?: string | null;
    link?: string | null;
    thumbnail?: string | null;
    published_at?: string | null;
  };
}

const DEFAULT_MONITOR: SocialMonitor = {
  name: "",
  platform: "youtube",
  source: "",
  feed_url: "",
  channel_id: "",
  role_id: "",
  enabled: true,
  last_entry_id: null,
  last_checked_at: null,
  last_posted_at: null,
  last_error: null,
};

function normalizeMonitor(raw: any): SocialMonitor {
  const platformRaw = String(raw?.platform || "rss").toLowerCase();
  const platform: SocialPlatform =
    platformRaw === "youtube" || platformRaw === "tiktok" ? platformRaw : "rss";

  return {
    ...DEFAULT_MONITOR,
    ...raw,
    platform,
    source: String(raw?.source || ""),
    name: raw?.name ? String(raw.name) : "",
    feed_url: raw?.feed_url ? String(raw.feed_url) : "",
    channel_id: raw?.channel_id ? String(raw.channel_id) : "",
    role_id: raw?.role_id ? String(raw.role_id) : "",
    enabled: Boolean(raw?.enabled ?? true),
    last_entry_id: raw?.last_entry_id ? String(raw.last_entry_id) : null,
    last_checked_at: raw?.last_checked_at ? String(raw.last_checked_at) : null,
    last_posted_at: raw?.last_posted_at ? String(raw.last_posted_at) : null,
    last_error: raw?.last_error ? String(raw.last_error) : null,
  };
}

export default function SocialNotificationsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [monitors, setMonitors] = useState<SocialMonitor[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [testingSource, setTestingSource] = useState(false);
  const [postingTest, setPostingTest] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<SocialTestResult | null>(null);

  const [health, setHealth] = useState<SocialHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const loadHealth = useCallback(async (silent = false) => {
    try {
      const data = await fetchApi(`/guilds/${guildId}/social/health`);
      setHealth(data as SocialHealth);
    } catch {
      if (!silent) toast("Failed to load social monitor status", "error");
    } finally {
      setHealthLoading(false);
    }
  }, [guildId, toast]);

  useEffect(() => {
    let mounted = true;

    fetchApi(`/guilds/${guildId}/social`)
      .then((data) => {
        const list = Array.isArray(data) ? data.map(normalizeMonitor) : [];
        if (!mounted) return;
        setMonitors(list);
        if (list.length > 0) setActiveIdx(0);
      })
      .catch(() => {
        if (mounted) toast("Failed to load social monitors", "error");
      })
      .finally(() => {
        if (mounted) setInitialLoadComplete(true);
      });

    loadHealth(true);
    const timer = window.setInterval(() => {
      loadHealth(true);
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [guildId, loadHealth, toast]);

  useEffect(() => {
    setLastTestResult(null);
  }, [activeIdx]);

  const persistMonitors = useCallback(async (nextMonitors: SocialMonitor[]) => {
    await fetchApi(`/guilds/${guildId}/social`, undefined, {
      method: "PUT",
      body: JSON.stringify(
        nextMonitors.map((monitor) => ({
          name: monitor.name || null,
          platform: monitor.platform,
          source: monitor.source || "",
          feed_url: monitor.feed_url || null,
          channel_id: monitor.channel_id || null,
          role_id: monitor.role_id || null,
          enabled: Boolean(monitor.enabled),
          last_entry_id: monitor.last_entry_id || null,
          last_checked_at: monitor.last_checked_at || null,
          last_posted_at: monitor.last_posted_at || null,
          last_error: monitor.last_error || null,
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
    onError: () => toast("Auto-save failed for social monitors", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistMonitors(monitors);
      toast("Social monitors saved!");
    } catch {
      toast("Failed to save social monitors.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toDisplayError = (error: unknown) => {
    if (error instanceof Error && error.message) {
      return error.message.replace(/^API Error\s+\d+:\s*/i, "").trim() || "Unknown error.";
    }
    return "Unknown error.";
  };

  const handleTestSource = async () => {
    if (!activeMonitor || activeIdx < 0) {
      toast("Select a source to test first.", "error");
      return;
    }

    setTestingSource(true);
    setLastTestResult(null);

    try {
      const result = (await fetchApi(`/guilds/${guildId}/social/test`, undefined, {
        method: "POST",
        body: JSON.stringify({
          name: activeMonitor.name || null,
          platform: activeMonitor.platform,
          source: activeMonitor.source || "",
          feed_url: activeMonitor.feed_url || null,
          channel_id: activeMonitor.channel_id || null,
          role_id: activeMonitor.role_id || null,
          enabled: Boolean(activeMonitor.enabled),
        }),
      })) as SocialTestResult;

      const nowIso = new Date().toISOString();
      setLastTestResult(result);
      setMonitors((prev) => {
        if (activeIdx < 0 || activeIdx >= prev.length) return prev;
        const next = [...prev];
        next[activeIdx] = {
          ...next[activeIdx],
          feed_url: result.resolved_feed_url || next[activeIdx].feed_url || "",
          last_entry_id: result.latest_entry?.id || next[activeIdx].last_entry_id || null,
          last_checked_at: result.checked_at || nowIso,
          last_error: null,
        };
        return next;
      });

      toast("Social feed test passed.");
    } catch (error) {
      const message = toDisplayError(error);
      setMonitors((prev) => {
        if (activeIdx < 0 || activeIdx >= prev.length) return prev;
        const next = [...prev];
        next[activeIdx] = {
          ...next[activeIdx],
          last_checked_at: new Date().toISOString(),
          last_error: message,
        };
        return next;
      });
      toast(`Social feed test failed: ${message}`, "error");
    } finally {
      setTestingSource(false);
    }
  };

  const handleTestPostToChannel = async () => {
    if (!activeMonitor || activeIdx < 0) {
      toast("Select a source to test first.", "error");
      return;
    }

    if (!(activeMonitor.channel_id || "").trim()) {
      toast("Select a Post Channel before sending a test post.", "error");
      return;
    }

    setPostingTest(true);

    try {
      const result = await fetchApi("/trigger/social_test_post", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            name: activeMonitor.name || null,
            platform: activeMonitor.platform,
            source: activeMonitor.source || "",
            feed_url: activeMonitor.feed_url || null,
            channel_id: activeMonitor.channel_id || null,
            role_id: activeMonitor.role_id || null,
            enabled: Boolean(activeMonitor.enabled),
          },
        }),
      }) as {
        status?: string;
        message?: string;
        resolved_feed_url?: string;
        latest_entry_id?: string;
      };

      const nowIso = new Date().toISOString();
      setMonitors((prev) => {
        if (activeIdx < 0 || activeIdx >= prev.length) return prev;
        const next = [...prev];
        next[activeIdx] = {
          ...next[activeIdx],
          feed_url: result?.resolved_feed_url || next[activeIdx].feed_url || "",
          last_entry_id: result?.latest_entry_id || next[activeIdx].last_entry_id || null,
          last_checked_at: nowIso,
          last_posted_at: nowIso,
          last_error: null,
        };
        return next;
      });

      toast(result?.message || "Social test post sent.");
    } catch (error) {
      const message = toDisplayError(error);
      setMonitors((prev) => {
        if (activeIdx < 0 || activeIdx >= prev.length) return prev;
        const next = [...prev];
        next[activeIdx] = {
          ...next[activeIdx],
          last_checked_at: new Date().toISOString(),
          last_error: message,
        };
        return next;
      });
      toast(`Test post failed: ${message}`, "error");
    } finally {
      setPostingTest(false);
    }
  };

  const addMonitor = () => {
    setMonitors((prev) => [...prev, { ...DEFAULT_MONITOR }]);
    setActiveIdx(monitors.length);
  };

  const removeMonitor = (index: number) => {
    const updated = monitors.filter((_, idx) => idx !== index);
    setMonitors(updated);
    if (updated.length === 0) {
      setActiveIdx(-1);
    } else if (activeIdx >= updated.length) {
      setActiveIdx(updated.length - 1);
    }
  };

  const updateMonitor = <K extends keyof SocialMonitor>(key: K, value: SocialMonitor[K]) => {
    if (activeIdx < 0) return;
    setMonitors((prev) => {
      const next = [...prev];
      next[activeIdx] = { ...next[activeIdx], [key]: value };
      return next;
    });
  };

  const activeMonitor = activeIdx >= 0 ? monitors[activeIdx] : null;
  const enabledCount = monitors.filter((m) => m.enabled).length;

  const statusLabel = useMemo(() => {
    if (healthLoading) return "Checking";
    if (health?.loop_healthy) return "Healthy";
    if (health?.last_error) return "Error";
    return "Stale";
  }, [health, healthLoading]);

  const statusDotClass = useMemo(() => {
    if (healthLoading) return "bg-slate-400";
    if (health?.loop_healthy) return "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.75)]";
    if (health?.last_error) return "bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.75)]";
    return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.75)]";
  }, [health, healthLoading]);

  const sourcePlaceholder =
    activeMonitor?.platform === "youtube"
      ? "YouTube channel URL, @handle, UC... channel id, or feed URL"
      : activeMonitor?.platform === "tiktok"
        ? "TikTok @username or feed URL (RSSHub, etc.)"
        : "RSS/Atom feed URL";

  const formatDate = (value: string | null | undefined) => {
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

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={BellRingIcon}
        title="Social Notifications"
        subtitle="Watch YouTube/TikTok/RSS feeds and auto-post new uploads into your selected channels."
        stats={[
          { label: "Monitors", value: monitors.length },
          { label: "Enabled", value: enabledCount },
          { label: "Loop Status", value: statusLabel },
          { label: "Last Poll", value: formatAge(health?.age_seconds) },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button
              variant="outline"
              onClick={handleTestSource}
              disabled={
                testingSource
                || !activeMonitor
                || (!activeMonitor.source.trim() && !(activeMonitor.feed_url || "").trim())
              }
            >
              {testingSource ? "Testing..." : "Test Source"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestPostToChannel}
              disabled={
                postingTest
                || !activeMonitor
                || !(activeMonitor.channel_id || "").trim()
                || (!activeMonitor.source.trim() && !(activeMonitor.feed_url || "").trim())
              }
            >
              {postingTest ? "Posting..." : "Test Post"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Monitors"}
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-[#1E1F22] bg-[#202225]/80 p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
            <span className="font-semibold text-white">Monitor Loop: {statusLabel}</span>
          </div>
          <span className="text-discord-text-muted">Last Poll: {formatDate(health?.last_poll_finished)}</span>
          <span className="text-discord-text-muted">Duration: {health?.last_poll_seconds ?? "N/A"}s</span>
          <span className="text-discord-text-muted">Notifications: {health?.last_notifications ?? 0}</span>
          <span className="text-discord-text-muted">Enabled: {health?.enabled_monitor_count ?? enabledCount}</span>
        </div>
        {health?.last_error && (
          <p className="mt-2 text-xs text-rose-300">Last Loop Error: {health.last_error}</p>
        )}
      </div>

      <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[500px]">
        <div className="w-72 shrink-0 flex flex-col gap-2 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Sources</span>
            <button
              onClick={addMonitor}
              className="flex items-center gap-1 text-xs text-discord-text-muted hover:text-white bg-[#1E1F22] hover:bg-discord-blurple rounded-md px-2 py-1 transition"
            >
              <PlusIcon className="w-3 h-3" /> Add
            </button>
          </div>

          {monitors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-60">
              <RssIcon className="w-8 h-8 mb-2 text-discord-text-muted" />
              <p className="text-xs text-discord-text-muted">No social monitors yet.<br />Click Add to begin.</p>
            </div>
          )}

          {monitors.map((monitor, idx) => {
            const label = monitor.name || monitor.source || `${monitor.platform.toUpperCase()} Source`;
            const isActive = idx === activeIdx;
            return (
              <button
                key={`${monitor.platform}-${idx}`}
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center justify-between gap-2 text-left px-3 py-2 rounded-md transition-colors ${
                  isActive ? "bg-discord-blurple text-white font-medium shadow-sm" : "text-discord-text hover:bg-[#383A40]"
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm">{label}</span>
                  <span className={`text-[10px] uppercase tracking-wider ${isActive ? "text-white/80" : "text-discord-text-muted"}`}>
                    {monitor.platform}
                  </span>
                </div>
                <span className={`h-2 w-2 rounded-full ${monitor.enabled ? "bg-emerald-400" : "bg-slate-500"}`} />
              </button>
            );
          })}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 relative overflow-y-auto">
            {activeMonitor ? (
              <div className="flex flex-col gap-6 h-full">
                <div className="flex items-center justify-between border-b border-[#1E1F22] pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{activeMonitor.name || "Social Source"}</h2>
                    <p className="text-sm text-discord-text-muted mt-1">
                      New entries are detected automatically and posted when the feed updates.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-discord-text-muted">
                    <input
                      type="checkbox"
                      checked={activeMonitor.enabled}
                      onChange={(e) => updateMonitor("enabled", e.target.checked)}
                      className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple focus:ring-2 focus:ring-discord-blurple"
                    />
                    Enabled
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Display Name</label>
                    <Input
                      value={activeMonitor.name || ""}
                      onChange={(e) => updateMonitor("name", e.target.value)}
                      placeholder="e.g. SeisenHub YouTube"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Platform</label>
                    <select
                      value={activeMonitor.platform}
                      onChange={(e) => updateMonitor("platform", e.target.value as SocialPlatform)}
                      className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text transition-colors hover:border-[#1E1F22] focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="tiktok">TikTok</option>
                      <option value="rss">RSS / Atom</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Source</label>
                    <Input
                      value={activeMonitor.source}
                      onChange={(e) => updateMonitor("source", e.target.value)}
                      placeholder={sourcePlaceholder}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Feed URL Override (Optional)</label>
                    <Input
                      value={activeMonitor.feed_url || ""}
                      onChange={(e) => updateMonitor("feed_url", e.target.value)}
                      placeholder="Leave blank to auto-resolve from Source"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Post Channel</label>
                    <ChannelSelect
                      guildId={guildId}
                      value={activeMonitor.channel_id || ""}
                      onChange={(id) => updateMonitor("channel_id", id)}
                      placeholder="Select channel..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-discord-text-muted">Ping Role (Optional)</label>
                    <RoleSelect
                      guildId={guildId}
                      value={activeMonitor.role_id || ""}
                      onChange={(id) => updateMonitor("role_id", id)}
                      placeholder="No ping role"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[#1E1F22] bg-[#202225]/80 p-4 text-xs text-discord-text-muted space-y-2">
                  <div><span className="text-white font-semibold">Resolved Feed:</span> {activeMonitor.feed_url || "Not resolved yet"}</div>
                  <div><span className="text-white font-semibold">Last Entry ID:</span> {activeMonitor.last_entry_id || "None"}</div>
                  <div><span className="text-white font-semibold">Last Checked:</span> {formatDate(activeMonitor.last_checked_at)}</div>
                  <div><span className="text-white font-semibold">Last Posted:</span> {formatDate(activeMonitor.last_posted_at)}</div>
                  <div className={activeMonitor.last_error ? "text-rose-300" : ""}>
                    <span className="text-white font-semibold">Last Error:</span> {activeMonitor.last_error || "None"}
                  </div>
                  {lastTestResult && (
                    <>
                      <div><span className="text-white font-semibold">Last Test:</span> {formatDate(lastTestResult.checked_at)}</div>
                      <div><span className="text-white font-semibold">Latest Title:</span> {lastTestResult.latest_entry?.title || "Unknown"}</div>
                      <div>
                        <span className="text-white font-semibold">Latest Link:</span>{" "}
                        {lastTestResult.latest_entry?.link
                          ? (
                            <a
                              href={lastTestResult.latest_entry.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-discord-blurple hover:underline"
                            >
                              Open latest post
                            </a>
                          )
                          : "N/A"}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end mt-auto pt-2">
                  <Button
                    variant="ghost"
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => removeMonitor(activeIdx)}
                  >
                    <Trash2Icon className="w-4 h-4 mr-1.5" /> Remove Source
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-discord-text-muted flex h-full flex-col items-center justify-center gap-3 text-center">
                <RssIcon className="h-10 w-10 opacity-50" />
                <p>Select a source on the left or create a new one to configure social notifications.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

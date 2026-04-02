"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import {
  Clock3Icon,
  GiftIcon,
  PlayIcon,
  PlusIcon,
  RefreshCcwIcon,
  TrophyIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";

type GiveawayKeyTier = "none" | "weekly" | "monthly" | "lifetime";

function normalizeKeyTier(value: unknown): GiveawayKeyTier {
  const tier = String(value || "none").trim().toLowerCase();
  if (tier === "weekly" || tier === "monthly" || tier === "lifetime") {
    return tier;
  }
  return "none";
}

function keyTierLabel(tier: GiveawayKeyTier): string {
  if (tier === "weekly") return "Weekly";
  if (tier === "monthly") return "Monthly";
  if (tier === "lifetime") return "Lifetime";
  return "None";
}

interface GiveawayDraft {
  name: string;
  reward_title: string;
  reward_description: string;
  channel_id: string;
  winner_count: number;
  duration_minutes: number;
  ping_role_id: string;
  key_log_channel_id: string;
  emoji: string;
  key_tier: GiveawayKeyTier;
}

interface GiveawayItem {
  guild_id?: string | null;
  channel_id?: string | null;
  message_id?: string | null;
  host_id?: string | null;
  reward_title: string;
  reward_description: string;
  winner_count: number;
  duration_minutes: number;
  ping_role_id?: string | null;
  key_log_channel_id?: string | null;
  emoji: string;
  created_at?: string | null;
  end_at?: string | null;
  ended: boolean;
  ended_at?: string | null;
  ended_by?: string | null;
  ended_reason?: string | null;
  entry_count: number;
  winners: string[];
  jump_url?: string | null;
  reroll_count?: number;
  last_rerolled_at?: string | null;
  last_rerolled_by?: string | null;
  last_reroll_winners?: string[];
  key_tier?: GiveawayKeyTier;
  key_delivery?: {
    tier?: GiveawayKeyTier;
    delivered_count?: number;
    failed_count?: number;
    failed_user_ids?: string[];
    last_delivery_at?: string | null;
  } | null;
  awarded_user_ids?: string[];
  is_active?: boolean;
  is_pending_end?: boolean;
}

interface GiveawayListResponse {
  active_count: number;
  total_count: number;
  items: GiveawayItem[];
}

const DEFAULT_DRAFT: GiveawayDraft = {
  name: "Giveaway 1",
  reward_title: "",
  reward_description: "",
  channel_id: "",
  winner_count: 1,
  duration_minutes: 60,
  ping_role_id: "",
  key_log_channel_id: "",
  emoji: "🎉",
  key_tier: "none",
};

function normalizeDraft(raw: any, fallbackName: string): GiveawayDraft {
  const winnerCount = Math.max(1, Math.min(25, Number(raw?.winner_count || 1)));
  const durationMinutes = Math.max(1, Math.min(10080, Number(raw?.duration_minutes || 60)));
  const emoji = String(raw?.emoji || "🎉").trim() || "🎉";
  const keyTier = normalizeKeyTier(raw?.key_tier);

  return {
    ...DEFAULT_DRAFT,
    ...raw,
    name: String(raw?.name || fallbackName || DEFAULT_DRAFT.name),
    reward_title: String(raw?.reward_title || ""),
    reward_description: String(raw?.reward_description || ""),
    channel_id: String(raw?.channel_id || ""),
    winner_count: winnerCount,
    duration_minutes: durationMinutes,
    ping_role_id: String(raw?.ping_role_id || ""),
    key_log_channel_id: String(raw?.key_log_channel_id || ""),
    emoji,
    key_tier: keyTier,
  };
}

function formatAbsoluteTime(value?: string | null): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}

function formatRemaining(value?: string | null): string {
  if (!value) return "Unknown";
  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) return "Unknown";

  const diff = end - Date.now();
  if (diff <= 0) return "Ended";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function statusLabel(item: GiveawayItem): "Active" | "Pending End" | "Ended" {
  if (item.ended) return "Ended";
  if (item.is_pending_end) return "Pending End";
  return "Active";
}

export default function GiveawaysPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, GiveawayDraft>>({});
  const [activeDraftKey, setActiveDraftKey] = useState<string>("");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return await res.json();
      })
      .then((data) => {
        if (data?.id) setCurrentUserId(String(data.id));
      })
      .catch(() => {
        // No-op; dashboard triggers can still run without explicit user id.
      });
  }, []);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/giveaway_drafts`)
      .then((data) => {
        const source = data && typeof data === "object" ? data : {};
        const normalized: Record<string, GiveawayDraft> = {};

        for (const [key, value] of Object.entries(source)) {
          normalized[key] = normalizeDraft(value, key);
        }

        if (Object.keys(normalized).length === 0) {
          normalized[DEFAULT_DRAFT.name] = { ...DEFAULT_DRAFT };
        }

        setDrafts(normalized);
        setActiveDraftKey(Object.keys(normalized)[0] || DEFAULT_DRAFT.name);
      })
      .catch(() => toast("Failed to load giveaway drafts", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistDrafts = useCallback(async (nextDrafts: Record<string, GiveawayDraft>) => {
    await fetchApi(`/guilds/${guildId}/giveaway_drafts`, undefined, {
      method: "PUT",
      body: JSON.stringify(nextDrafts),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: drafts,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1500,
    onSave: persistDrafts,
    onError: () => toast("Auto-save failed for giveaway drafts", "error"),
  });

  const loadGiveaways = useCallback(async (silent = false) => {
    try {
      const data = (await fetchApi(`/guilds/${guildId}/giveaways`)) as GiveawayListResponse;
      const list = Array.isArray(data?.items) ? data.items : [];
      setGiveaways(list);
      setActiveCount(Number(data?.active_count || 0));
    } catch {
      if (!silent) {
        toast("Failed to load giveaway status", "error");
      }
    }
  }, [guildId, toast]);

  useEffect(() => {
    loadGiveaways(true);
    const timer = window.setInterval(() => {
      loadGiveaways(true);
    }, 20000);

    return () => window.clearInterval(timer);
  }, [loadGiveaways]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistDrafts(drafts);
      toast("Giveaway drafts saved!");
    } catch {
      toast("Failed to save giveaway drafts", "error");
    } finally {
      setSaving(false);
    }
  };

  const addDraft = () => {
    const nextIndex = Object.keys(drafts).length + 1;
    let key = `Giveaway ${nextIndex}`;
    while (drafts[key]) {
      key = `Giveaway ${Math.floor(Math.random() * 10000)}`;
    }

    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...DEFAULT_DRAFT,
        name: key,
      },
    }));
    setActiveDraftKey(key);
  };

  const removeDraft = (key: string) => {
    const updated = { ...drafts };
    delete updated[key];

    if (Object.keys(updated).length === 0) {
      updated[DEFAULT_DRAFT.name] = { ...DEFAULT_DRAFT };
    }

    setDrafts(updated);
    setActiveDraftKey(Object.keys(updated)[0] || DEFAULT_DRAFT.name);
  };

  const updateDraft = (patch: Partial<GiveawayDraft>) => {
    if (!activeDraftKey) return;
    setDrafts((prev) => ({
      ...prev,
      [activeDraftKey]: {
        ...prev[activeDraftKey],
        ...patch,
      },
    }));
  };

  const activeDraft = drafts[activeDraftKey];
  const endedCount = giveaways.filter((item) => item.ended).length;
  const activeGiveaways = giveaways.filter((item) => !item.ended);
  const endedGiveaways = giveaways.filter((item) => item.ended);
  const readyToLaunch = Boolean(
    activeDraft?.channel_id &&
      activeDraft?.reward_title.trim().length >= 2 &&
      activeDraft?.winner_count >= 1 &&
      activeDraft?.duration_minutes >= 1
  );

  const launchGiveaway = async () => {
    if (!activeDraft) return;

    if (!activeDraft.channel_id) {
      toast("Select a giveaway channel first", "error");
      return;
    }

    if (activeDraft.reward_title.trim().length < 2) {
      toast("Reward title must be at least 2 characters", "error");
      return;
    }

    setLaunching(true);
    const hostUserId = currentUserId || undefined;
    try {
      await fetchApi("/trigger/create_giveaway", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_id: activeDraft.channel_id,
            reward_title: activeDraft.reward_title.trim(),
            reward_description: activeDraft.reward_description.trim(),
            winner_count: Math.max(1, Math.min(25, Number(activeDraft.winner_count || 1))),
            duration_minutes: Math.max(1, Math.min(10080, Number(activeDraft.duration_minutes || 60))),
            ping_role_id: activeDraft.ping_role_id || null,
            key_log_channel_id: activeDraft.key_log_channel_id || null,
            host_user_id: hostUserId,
            emoji: activeDraft.emoji || "🎉",
            key_tier: normalizeKeyTier(activeDraft.key_tier),
          },
        }),
      });

      toast("Giveaway started! Members can join by reacting with the giveaway emoji.");
      await loadGiveaways(true);
    } catch (err: any) {
      toast(`Failed to start giveaway: ${err.message}`, "error");
    } finally {
      setLaunching(false);
    }
  };

  const endGiveawayNow = async (messageId?: string | null) => {
    if (!messageId) return;

    const actionKey = `end:${messageId}`;
    setBusyAction(actionKey);
    try {
      await fetchApi("/trigger/end_giveaway", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            message_id: messageId,
            ended_by_user_id: currentUserId || undefined,
          },
        }),
      });
      toast("Giveaway ended and winners were announced.");
      await loadGiveaways(true);
    } catch (err: any) {
      toast(`Failed to end giveaway: ${err.message}`, "error");
    } finally {
      setBusyAction("");
    }
  };

  const rerollGiveawayNow = async (messageId?: string | null) => {
    if (!messageId) return;

    const actionKey = `reroll:${messageId}`;
    setBusyAction(actionKey);
    try {
      await fetchApi("/trigger/reroll_giveaway", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            message_id: messageId,
            rerolled_by_user_id: currentUserId || undefined,
          },
        }),
      });
      toast("Reroll complete. New winner(s) were announced.");
      await loadGiveaways(true);
    } catch (err: any) {
      toast(`Failed to reroll giveaway: ${err.message}`, "error");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={GiftIcon}
        title="Giveaways"
        subtitle="Launch reaction-based giveaways, auto-pick winners when time is up, and manually end or reroll winners anytime."
        stats={[
          { label: "Drafts", value: Object.keys(drafts).length },
          { label: "Active", value: activeCount },
          { label: "Ended", value: endedCount },
          { label: "Ready", value: readyToLaunch ? "Yes" : "No" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Drafts"}
            </Button>
            <Button variant="discord" onClick={launchGiveaway} disabled={launching || !readyToLaunch}>
              {launching ? "Launching..." : "Start Giveaway"}
            </Button>
          </div>
        }
      />

      <div className="flex gap-6 min-h-[620px]">
        <div className="w-64 shrink-0 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-discord-text-muted">Drafts</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addDraft}>
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            {Object.keys(drafts).map((key) => (
              <div key={key} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveDraftKey(key)}
                  className={`flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeDraftKey === key
                      ? "bg-discord-blurple text-white"
                      : "text-discord-text-muted hover:bg-[#383A40] hover:text-white"
                  }`}
                >
                  {drafts[key].name || key}
                </button>
                <button
                  type="button"
                  onClick={() => removeDraft(key)}
                  className="rounded-md p-1 text-red-400 opacity-0 transition hover:bg-red-500/10 group-hover:opacity-100"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
          {!activeDraft ? (
            <div className="flex h-full items-center justify-center text-sm text-discord-text-muted">Select a giveaway draft.</div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Draft Name</label>
                  <Input
                    value={activeDraft.name}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    placeholder="Weekend Nitro Drop"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Reward Title</label>
                  <Input
                    value={activeDraft.reward_title}
                    onChange={(e) => updateDraft({ reward_title: e.target.value })}
                    placeholder="1x Nitro Basic"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Reward Description</label>
                  <Textarea
                    value={activeDraft.reward_description}
                    onChange={(e) => updateDraft({ reward_description: e.target.value })}
                    placeholder="React with 🎉 to enter. Winners will be picked automatically at the end time."
                    className="min-h-[96px]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Giveaway Channel</label>
                    <ChannelSelect
                      guildId={guildId}
                      value={activeDraft.channel_id || ""}
                      onChange={(id) => updateDraft({ channel_id: id })}
                      placeholder="Select channel..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Ping Role (Optional)</label>
                    <RoleSelect
                      guildId={guildId}
                      value={activeDraft.ping_role_id || ""}
                      onChange={(id) => updateDraft({ ping_role_id: id })}
                      placeholder="No ping role"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Key Log Channel (Optional)</label>
                    <ChannelSelect
                      guildId={guildId}
                      value={activeDraft.key_log_channel_id || ""}
                      onChange={(id) => updateDraft({ key_log_channel_id: id })}
                      placeholder="No key log channel"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Winners</label>
                    <Input
                      type="number"
                      min={1}
                      max={25}
                      value={activeDraft.winner_count}
                      onChange={(e) => {
                        const next = Math.max(1, Math.min(25, Number(e.target.value) || 1));
                        updateDraft({ winner_count: next });
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Duration (Minutes)</label>
                    <Input
                      type="number"
                      min={1}
                      max={10080}
                      value={activeDraft.duration_minutes}
                      onChange={(e) => {
                        const next = Math.max(1, Math.min(10080, Number(e.target.value) || 60));
                        updateDraft({ duration_minutes: next });
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Join Emoji</label>
                    <Input
                      value={activeDraft.emoji || "🎉"}
                      onChange={(e) => updateDraft({ emoji: e.target.value || "🎉" })}
                      placeholder="🎉"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Key Tier</label>
                    <select
                      value={normalizeKeyTier(activeDraft.key_tier)}
                      onChange={(e) => updateDraft({ key_tier: normalizeKeyTier(e.target.value) })}
                      className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm text-discord-text outline-none transition focus:border-discord-blurple"
                    >
                      <option value="none">No key reward</option>
                      <option value="weekly">Weekly key</option>
                      <option value="monthly">Monthly key</option>
                      <option value="lifetime">Lifetime key</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#1E1F22] bg-[#2f3136] p-4 shadow-inner">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-discord-text-muted">Preview</p>
                <div className="rounded-xl border border-white/10 bg-[#36393f] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#b5bac1]">🎉 GIVEAWAY</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#f2f3f5]">
                    {activeDraft.reward_title?.trim() || "Reward title appears here"}
                  </p>

                  <p className="mt-2 text-sm text-[#dbdee1]">
                    {activeDraft.reward_description?.trim() || "Reward description appears here."}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#b5bac1]">
                    <div className="rounded-md bg-[#4a4d57] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#c8ccd2]">Winners</p>
                      <p className="mt-1 font-semibold text-[#f2f3f5]">{activeDraft.winner_count}</p>
                    </div>
                    <div className="rounded-md bg-[#4a4d57] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#c8ccd2]">Duration</p>
                      <p className="mt-1 font-semibold text-[#f2f3f5]">{activeDraft.duration_minutes}m</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#b5bac1]">
                    <span className="flex items-center gap-1.5"><UsersIcon className="h-3.5 w-3.5" /> Join with {activeDraft.emoji || "🎉"}</span>
                    <span className="flex items-center gap-1.5"><Clock3Icon className="h-3.5 w-3.5" /> Auto end</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Live Giveaway Indicator</h2>
            <p className="text-sm text-discord-text-muted">
              Only active giveaways are shown here. Ended giveaways are removed from this indicator automatically.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => loadGiveaways(false)}
            className="inline-flex items-center gap-2"
          >
            <RefreshCcwIcon className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {activeGiveaways.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#202225]/70 px-4 py-8 text-center text-sm text-discord-text-muted">
            No active giveaways right now. Start one from the editor above.
          </div>
        ) : (
          <div className="space-y-3">
            {activeGiveaways.map((item) => {
              const label = statusLabel(item);
              const entries = Math.max(0, Number(item.entry_count || 0));
              const messageId = item.message_id || "";
              const itemKeyTier = normalizeKeyTier(item.key_tier);

              return (
                <div key={messageId || `${item.reward_title}-${item.end_at}`} className="rounded-lg border border-white/10 bg-[#202225]/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{item.reward_title || "Untitled Giveaway"}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                            label === "Active"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : label === "Pending End"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-500/25 text-slate-300"
                          }`}
                        >
                          {label}
                        </span>
                      </div>

                      {item.reward_description && (
                        <p className="mt-1 line-clamp-2 text-sm text-discord-text-muted">{item.reward_description}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#b5bac1]">
                        <span className="flex items-center gap-1"><TrophyIcon className="h-3.5 w-3.5" /> Winners: {item.winner_count}</span>
                        <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> Entries: {entries}</span>
                        <span className="flex items-center gap-1"><Clock3Icon className="h-3.5 w-3.5" /> Ends: {formatRemaining(item.end_at)}</span>
                        {itemKeyTier !== "none" && <span>Key: {keyTierLabel(itemKeyTier)}</span>}
                        {messageId && <span>ID: {messageId}</span>}
                      </div>

                      <div className="mt-1 text-xs text-discord-text-muted">
                        End time: {formatAbsoluteTime(item.end_at)}
                        {item.ended_at ? ` • Ended: ${formatAbsoluteTime(item.ended_at)}` : ""}
                      </div>

                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.jump_url && (
                        <a
                          href={item.jump_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-[#122033] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-discord-text transition hover:border-discord-blurple/45 hover:text-white"
                        >
                          Open
                        </a>
                      )}

                      <Button
                        variant="outline"
                        disabled={busyAction === `end:${messageId}`}
                        onClick={() => endGiveawayNow(messageId)}
                        className="inline-flex items-center gap-1.5"
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        {busyAction === `end:${messageId}` ? "Ending..." : "End Now"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {endedGiveaways.length > 0 && (
        <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">Ended Giveaways</h2>
            <p className="text-sm text-discord-text-muted">
              Ended giveaways are listed here so you can reroll winners when needed.
            </p>
          </div>

          <div className="space-y-3">
            {endedGiveaways.map((item) => {
              const entries = Math.max(0, Number(item.entry_count || 0));
              const winners = Array.isArray(item.winners) ? item.winners : [];
              const rerollWinners = Array.isArray(item.last_reroll_winners) ? item.last_reroll_winners : [];
              const messageId = item.message_id || "";
              const itemKeyTier = normalizeKeyTier(item.key_tier);
              const keyDelivery = item.key_delivery && typeof item.key_delivery === "object" ? item.key_delivery : null;
              const deliveredCount = Math.max(0, Number(keyDelivery?.delivered_count || 0));
              const failedCount = Math.max(0, Number(keyDelivery?.failed_count || 0));

              return (
                <div key={`ended-${messageId || `${item.reward_title}-${item.ended_at}`}`} className="rounded-lg border border-white/10 bg-[#202225]/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{item.reward_title || "Untitled Giveaway"}</p>
                        <span className="rounded-full bg-slate-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
                          Ended
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#b5bac1]">
                        <span className="flex items-center gap-1"><TrophyIcon className="h-3.5 w-3.5" /> Winners: {item.winner_count}</span>
                        <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> Entries: {entries}</span>
                        {itemKeyTier !== "none" && <span>Key: {keyTierLabel(itemKeyTier)}</span>}
                        {messageId && <span>ID: {messageId}</span>}
                      </div>

                      <div className="mt-1 text-xs text-discord-text-muted">
                        Ended: {formatAbsoluteTime(item.ended_at || item.end_at)}
                      </div>

                      {winners.length > 0 && (
                        <div className="mt-2 text-xs text-emerald-300">
                          Winner(s): {winners.map((id) => `<@${id}>`).join(", ")}
                        </div>
                      )}

                      {rerollWinners.length > 0 && (
                        <div className="mt-1 text-xs text-sky-300">
                          Last reroll: {rerollWinners.map((id) => `<@${id}>`).join(", ")}
                        </div>
                      )}

                      {itemKeyTier !== "none" && (
                        <div className="mt-1 text-xs text-amber-300">
                          Key delivery: {deliveredCount} sent
                          {failedCount > 0 ? ` • ${failedCount} failed` : ""}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.jump_url && (
                        <a
                          href={item.jump_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-[#122033] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-discord-text transition hover:border-discord-blurple/45 hover:text-white"
                        >
                          Open
                        </a>
                      )}

                      <Button
                        variant="outline"
                        disabled={busyAction === `reroll:${messageId}`}
                        onClick={() => rerollGiveawayNow(messageId)}
                        className="inline-flex items-center gap-1.5"
                      >
                        <RefreshCcwIcon className="h-3.5 w-3.5" />
                        {busyAction === `reroll:${messageId}` ? "Rerolling..." : "Reroll"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

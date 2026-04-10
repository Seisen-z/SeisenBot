"use client";

import { use, useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GiftIcon, RefreshCcwIcon } from "lucide-react";

type ActivityRewardsConfig = {
  enabled: boolean;
  min_messages_low: number;
  min_messages_high: number;
  draw_interval_minutes: number;
  cooldown_days: number;
  max_rewards_per_draw: number;
  daily_winner_cap: number;
  weekly_winner_cap: number;
  key_pool: "activity_pool" | "giveaway";
  event_webhook_enabled: boolean;
  event_webhook_url?: string | null;
  event_webhook_retry_count: number;
};

type ActivityRewardsStatus = {
  tracked_users: number;
  eligible_users: number;
  last_draw_at?: string | null;
  next_draw_at?: string | null;
  recent?: Array<{
    at?: string;
    status?: string;
    winner_user_id?: string;
    tier?: string;
    min_required?: number;
    eligible_count?: number;
    error?: string;
  }>;
  claim_status_counts?: Record<string, number>;
};

type LeaderboardRow = {
  user_id: string;
  message_count: number;
  unique_days: number;
  total_rewards: number;
  last_message_at?: string | null;
  last_reward_at?: string | null;
};

const DEFAULT_CONFIG: ActivityRewardsConfig = {
  enabled: true,
  min_messages_low: 200,
  min_messages_high: 300,
  draw_interval_minutes: 360,
  cooldown_days: 7,
  max_rewards_per_draw: 1,
  daily_winner_cap: 3,
  weekly_winner_cap: 12,
  key_pool: "activity_pool",
  event_webhook_enabled: false,
  event_webhook_url: "",
  event_webhook_retry_count: 2,
};

function formatDate(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
}

export default function ActivityRewardsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [config, setConfig] = useState<ActivityRewardsConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<ActivityRewardsStatus>({
    tracked_users: 0,
    eligible_users: 0,
    recent: [],
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [actionBusy, setActionBusy] = useState("");

  const loadAll = async (silent = false) => {
    try {
      const [cfg, st] = await Promise.all([
        fetchApi(`/guilds/${guildId}/activity_rewards`),
        fetchApi(`/guilds/${guildId}/activity_rewards/status`),
      ]);
      const lb = await fetchApi(`/guilds/${guildId}/activity_rewards/leaderboard?limit=10`);
      setConfig({
        ...DEFAULT_CONFIG,
        ...cfg,
      });
      setStatus({
        tracked_users: Number(st?.tracked_users || 0),
        eligible_users: Number(st?.eligible_users || 0),
        last_draw_at: st?.last_draw_at || null,
        next_draw_at: st?.next_draw_at || null,
        recent: Array.isArray(st?.recent) ? st.recent : [],
        claim_status_counts: st?.claim_status_counts && typeof st.claim_status_counts === "object" ? st.claim_status_counts : {},
      });
      setLeaderboard(Array.isArray(lb?.items) ? lb.items : []);
    } catch (err: any) {
      if (!silent) toast(`Failed to load activity rewards: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    if (!config.event_webhook_enabled) {
      toast("Enable Event Webhook first before testing.", "error");
      return;
    }
    if (!String(config.event_webhook_url || "").trim()) {
      toast("Set Event Webhook URL before testing.", "error");
      return;
    }
    setTestingWebhook(true);
    try {
      await fetchApi(`/guilds/${guildId}/activity_rewards/test_webhook`, undefined, {
        method: "POST",
      });
      toast("Webhook test sent.");
      await loadAll(true);
    } catch (err: any) {
      toast(`Webhook test failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setTestingWebhook(false);
    }
  };

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
        // ignore
      });
  }, []);

  useEffect(() => {
    loadAll(true);
    const timer = window.setInterval(() => loadAll(true), 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const next = {
        ...config,
        min_messages_low: Math.max(1, Number(config.min_messages_low || 200)),
        min_messages_high: Math.max(Number(config.min_messages_low || 200), Number(config.min_messages_high || 300)),
        draw_interval_minutes: Math.max(5, Number(config.draw_interval_minutes || 360)),
        cooldown_days: Math.max(0, Number(config.cooldown_days || 7)),
        max_rewards_per_draw: Math.max(1, Math.min(5, Number(config.max_rewards_per_draw || 1))),
        daily_winner_cap: Math.max(1, Math.min(200, Number(config.daily_winner_cap || 1))),
        weekly_winner_cap: Math.max(1, Math.min(1000, Number(config.weekly_winner_cap || 1))),
      };
      await fetchApi(`/guilds/${guildId}/activity_rewards`, undefined, {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setConfig(next);
      toast("Activity rewards settings saved.");
      await loadAll(true);
    } catch (err: any) {
      toast(`Failed to save settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const runManualReroll = async () => {
    setActionBusy("reroll");
    try {
      await fetchApi("/trigger/activity_reward_reroll", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            actor_user_id: currentUserId || undefined,
          },
        }),
      });
      toast("Manual activity reward reroll executed.");
      await loadAll(true);
    } catch (err: any) {
      toast(`Reroll failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setActionBusy("");
    }
  };

  const runManualRevoke = async (userId: string) => {
    setActionBusy(`revoke:${userId}`);
    try {
      await fetchApi("/trigger/activity_reward_revoke", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            target_user_id: userId,
            actor_user_id: currentUserId || undefined,
          },
        }),
      });
      toast(`Revoked open reward channels for ${userId}.`);
      await loadAll(true);
    } catch (err: any) {
      toast(`Revoke failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={GiftIcon}
        title="Activity Rewards"
        subtitle="Random key drops for active community chatters. Users must pass the configured message threshold window before they are eligible for RNG selection."
        stats={[
          { label: "Tracked Users", value: status.tracked_users },
          { label: "Eligible Users", value: status.eligible_users },
          { label: "Last Draw", value: formatDate(status.last_draw_at) },
          { label: "Next Draw", value: formatDate(status.next_draw_at) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => loadAll(false)}>
              <RefreshCcwIcon className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="discord" onClick={saveConfig} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            <Button
              variant="outline"
              onClick={testWebhook}
              disabled={
                testingWebhook ||
                !config.event_webhook_enabled ||
                !String(config.event_webhook_url || "").trim()
              }
            >
              {testingWebhook ? "Testing..." : "Test Webhook"}
            </Button>
            <Button variant="outline" onClick={runManualReroll} disabled={actionBusy === "reroll"}>
              {actionBusy === "reroll" ? "Rerolling..." : "Manual Reroll"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Enabled</span>
          <select
            value={config.enabled ? "1" : "0"}
            onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.value === "1" }))}
            className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm text-discord-text outline-none transition focus:border-white/30"
          >
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Daily Winner Cap</span>
          <Input
            type="number"
            min={1}
            max={200}
            value={config.daily_winner_cap}
            onChange={(e) => setConfig((prev) => ({ ...prev, daily_winner_cap: Number(e.target.value || 1) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Weekly Winner Cap</span>
          <Input
            type="number"
            min={1}
            max={1000}
            value={config.weekly_winner_cap}
            onChange={(e) => setConfig((prev) => ({ ...prev, weekly_winner_cap: Number(e.target.value || 1) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Min Messages (Low)</span>
          <Input
            type="number"
            min={1}
            value={config.min_messages_low}
            onChange={(e) => setConfig((prev) => ({ ...prev, min_messages_low: Number(e.target.value || 1) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Min Messages (High)</span>
          <Input
            type="number"
            min={1}
            value={config.min_messages_high}
            onChange={(e) => setConfig((prev) => ({ ...prev, min_messages_high: Number(e.target.value || 1) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Draw Interval (Minutes)</span>
          <Input
            type="number"
            min={5}
            value={config.draw_interval_minutes}
            onChange={(e) => setConfig((prev) => ({ ...prev, draw_interval_minutes: Number(e.target.value || 5) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Cooldown (Days)</span>
          <Input
            type="number"
            min={0}
            value={config.cooldown_days}
            onChange={(e) => setConfig((prev) => ({ ...prev, cooldown_days: Number(e.target.value || 0) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Max Winners / Draw</span>
          <Input
            type="number"
            min={1}
            max={5}
            value={config.max_rewards_per_draw}
            onChange={(e) => setConfig((prev) => ({ ...prev, max_rewards_per_draw: Number(e.target.value || 1) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Key Source Pool</span>
          <select
            value={config.key_pool}
            onChange={(e) => setConfig((prev) => ({ ...prev, key_pool: (e.target.value as "activity_pool" | "giveaway") }))}
            className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm text-discord-text outline-none transition focus:border-white/30"
          >
            <option value="activity_pool">Activity Pool Webhooks</option>
            <option value="giveaway">Giveaway Weekly Pool</option>
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Event Webhook URL</span>
          <Input
            value={String(config.event_webhook_url || "")}
            onChange={(e) => setConfig((prev) => ({ ...prev, event_webhook_url: e.target.value }))}
            placeholder="https://example.com/webhook"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Event Webhook Enabled</span>
          <select
            value={config.event_webhook_enabled ? "1" : "0"}
            onChange={(e) => setConfig((prev) => ({ ...prev, event_webhook_enabled: e.target.value === "1" }))}
            className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm text-discord-text outline-none transition focus:border-white/30"
          >
            <option value="0">Disabled</option>
            <option value="1">Enabled</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Event Webhook Retries</span>
          <Input
            type="number"
            min={0}
            max={5}
            value={config.event_webhook_retry_count}
            onChange={(e) => setConfig((prev) => ({ ...prev, event_webhook_retry_count: Number(e.target.value || 0) }))}
          />
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <h3 className="text-sm font-semibold text-white">Recent Draw Activity</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-discord-text-muted">
          <span>Claims pending: {Number(status.claim_status_counts?.pending || 0)}</span>
          <span>Claimed: {Number(status.claim_status_counts?.claimed || 0)}</span>
          <span>Closed: {Number(status.claim_status_counts?.closed || 0)}</span>
          <span>Voided: {Number(status.claim_status_counts?.voided || 0)}</span>
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-discord-text-muted">Loading status...</p>
        ) : (status.recent || []).length === 0 ? (
          <p className="mt-2 text-sm text-discord-text-muted">No draw history yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {(status.recent || []).slice().reverse().map((item, index) => (
              <div key={`${item.at || "unknown"}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-discord-text">
                <span className="font-semibold text-white/90">{String(item.status || "unknown")}</span>
                {" • "}
                <span>{formatDate(item.at)}</span>
                {item.winner_user_id ? <> • winner: {item.winner_user_id}</> : null}
                {item.tier ? <> • tier: {item.tier}</> : null}
                {typeof item.min_required === "number" ? <> • threshold: {item.min_required}</> : null}
                {typeof item.eligible_count === "number" ? <> • eligible: {item.eligible_count}</> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <h3 className="text-sm font-semibold text-white">Top Activity Leaderboard</h3>
        {leaderboard.length === 0 ? (
          <p className="mt-2 text-sm text-discord-text-muted">No leaderboard data yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {leaderboard.map((row, index) => (
              <div key={`${row.user_id}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-discord-text">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/95">
                    #{index + 1} • {row.user_id} • msgs: {row.message_count} • days: {row.unique_days} • rewards: {row.total_rewards}
                  </span>
                  <Button
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={actionBusy === `revoke:${row.user_id}`}
                    onClick={() => runManualRevoke(row.user_id)}
                  >
                    {actionBusy === `revoke:${row.user_id}` ? "Revoking..." : "Revoke"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

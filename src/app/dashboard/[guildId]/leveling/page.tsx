"use client";

import { use, useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, ChannelMultiSelect, RoleSelect } from "@/components/ui/discord-selects";
import { TrendingUpIcon, RefreshCcwIcon, PlusIcon, TrashIcon } from "lucide-react";

type LevelingTier = {
  id: string;
  name: string;
  threshold: number;
  role_id: string;
};

type LevelingConfig = {
  enabled: boolean;
  excluded_channel_ids: string[];
  cooldown_seconds: number;
  announce_level_up: boolean;
  announce_channel_id: string | null;
  level_up_message: string;
  tiers: LevelingTier[];
};

type LeaderboardRow = {
  user_id: string;
  user_name?: string;
  message_count: number;
  current_tier?: string | null;
  last_message_at?: string | null;
};

const DEFAULT_CONFIG: LevelingConfig = {
  enabled: true,
  excluded_channel_ids: [],
  cooldown_seconds: 5,
  announce_level_up: true,
  announce_channel_id: null,
  level_up_message: "🎉 {mention} just reached **{tier_name}** ({messages} messages) and unlocked {role_mention}!",
  tiers: [],
};

function makeTierId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function LevelingPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<LevelingConfig>(DEFAULT_CONFIG);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const loadConfig = async (silent = false) => {
    try {
      const cfg = await fetchApi(`/guilds/${guildId}/leveling`);
      setConfig({
        ...DEFAULT_CONFIG,
        ...cfg,
        tiers: Array.isArray(cfg?.tiers) ? cfg.tiers : [],
        excluded_channel_ids: Array.isArray(cfg?.excluded_channel_ids) ? cfg.excluded_channel_ids : [],
      });
    } catch (err: any) {
      if (!silent) toast(`Failed to load leveling settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async (silent = true) => {
    try {
      const lb = await fetchApi(`/guilds/${guildId}/leveling/leaderboard?limit=10`);
      setLeaderboard(Array.isArray(lb?.items) ? lb.items : []);
    } catch (err: any) {
      if (!silent) toast(`Failed to load leaderboard: ${err?.message || "Unknown error"}`, "error");
    }
  };

  // Config is loaded once on mount (and again after a save) — never on the
  // background interval, so it can't clobber tiers/settings you're mid-editing.
  useEffect(() => {
    loadConfig(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  // The leaderboard is safe to refresh in the background since it isn't editable.
  useEffect(() => {
    loadLeaderboard(true);
    const timer = window.setInterval(() => loadLeaderboard(true), 20000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const next: LevelingConfig = {
        ...config,
        cooldown_seconds: Math.max(0, Number(config.cooldown_seconds || 0)),
        tiers: config.tiers
          .filter((t) => t.role_id)
          .map((t) => ({
            ...t,
            name: t.name?.trim() || `Level ${t.threshold}`,
            threshold: Math.max(1, Number(t.threshold || 1)),
          }))
          .sort((a, b) => a.threshold - b.threshold),
      };
      await fetchApi(`/guilds/${guildId}/leveling`, undefined, {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setConfig(next);
      toast("Leveling settings saved.");
      await loadLeaderboard(true);
    } catch (err: any) {
      toast(`Failed to save settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const addTier = () => {
    setConfig((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        { id: makeTierId(), name: `Level ${prev.tiers.length + 1}`, threshold: 200, role_id: "" },
      ],
    }));
  };

  const updateTier = (id: string, patch: Partial<LevelingTier>) => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const removeTier = (id: string) => {
    setConfig((prev) => ({ ...prev, tiers: prev.tiers.filter((t) => t.id !== id) }));
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={TrendingUpIcon}
        title="Leveling"
        subtitle="Members earn message-count based tiers as they chat. Each tier grants a role once its message threshold is reached. Messages sent in excluded channels never count."
        stats={[
          { label: "Tiers Configured", value: config.tiers.length },
          { label: "Excluded Channels", value: config.excluded_channel_ids.length },
          { label: "Tracked Members", value: leaderboard.length },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                loadConfig(false);
                loadLeaderboard(false);
              }}
            >
              <RefreshCcwIcon className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="discord" onClick={saveConfig} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
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
            className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm outline-none transition focus:border-white/30 text-discord-text"
          >
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Message Cooldown (Seconds)</span>
          <Input
            type="number"
            min={0}
            value={config.cooldown_seconds}
            onChange={(e) => setConfig((prev) => ({ ...prev, cooldown_seconds: Number(e.target.value || 0) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Announce Level Ups</span>
          <select
            value={config.announce_level_up ? "1" : "0"}
            onChange={(e) => setConfig((prev) => ({ ...prev, announce_level_up: e.target.value === "1" }))}
            className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm outline-none transition focus:border-white/30 text-discord-text"
          >
            <option value="1">Announce</option>
            <option value="0">Silent</option>
          </select>
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">
            Announcement Channel <span className="normal-case text-[10px] text-discord-text-muted">(blank = same channel they leveled up in)</span>
          </span>
          <ChannelSelect
            guildId={guildId}
            value={config.announce_channel_id || ""}
            onChange={(val) => setConfig((prev) => ({ ...prev, announce_channel_id: val || null }))}
            placeholder="Same channel as message..."
          />
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Excluded Channels</span>
          <ChannelMultiSelect
            guildId={guildId}
            value={config.excluded_channel_ids}
            onChange={(ids) => setConfig((prev) => ({ ...prev, excluded_channel_ids: ids }))}
            placeholder="No excluded channels — messages everywhere count"
          />
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">
            Level Up Message <span className="normal-case text-[10px] text-discord-text-muted">({"{mention}"}, {"{tier_name}"}, {"{messages}"}, {"{role_mention}"})</span>
          </span>
          <Textarea
            value={config.level_up_message}
            onChange={(e) => setConfig((prev) => ({ ...prev, level_up_message: e.target.value }))}
            rows={2}
          />
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Tiers</h3>
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={addTier}>
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Tier
          </Button>
        </div>
        {config.tiers.length === 0 ? (
          <p className="mt-3 text-sm text-discord-text-muted">
            No tiers yet. Add one to start promoting members, e.g. 200 messages → &quot;Active Member&quot;.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {config.tiers.map((tier) => (
              <div
                key={tier.id}
                className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end"
              >
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-discord-text-muted">Name</span>
                  <Input
                    value={tier.name}
                    onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-discord-text-muted">Messages</span>
                  <Input
                    type="number"
                    min={1}
                    value={tier.threshold}
                    onChange={(e) => updateTier(tier.id, { threshold: Number(e.target.value || 1) })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-discord-text-muted">Role Granted</span>
                  <RoleSelect
                    guildId={guildId}
                    value={tier.role_id}
                    onChange={(id) => updateTier(tier.id, { role_id: id })}
                  />
                </label>
                <Button
                  variant="outline"
                  className="h-10 px-3 text-red-400 hover:text-red-300"
                  onClick={() => removeTier(tier.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <h3 className="text-sm font-semibold text-white">Top Members</h3>
        {loading ? (
          <p className="mt-2 text-sm text-discord-text-muted">Loading leaderboard...</p>
        ) : leaderboard.length === 0 ? (
          <p className="mt-2 text-sm text-discord-text-muted">No leveling stats yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {leaderboard.map((row, index) => (
              <div key={`${row.user_id}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-discord-text">
                #{index + 1} • {row.user_name || row.user_id} • msgs: {row.message_count}
                {row.current_tier ? <> • tier: {row.current_tier}</> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

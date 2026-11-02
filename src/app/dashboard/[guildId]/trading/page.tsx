"use client";

import { useEffect, useRef, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelMultiSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { Input } from "@/components/ui/input";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { Handshake } from "lucide-react";

interface TradingSettings {
  enabled: boolean;
  channel_ids: string[];
  stats_channel_ids: string[];
  staff_role_ids: string[];
  emoji: string;
}

interface LeaderRow {
  user_id: string;
  name: string;
  up: number;
  down: number;
  trades: number;
}

interface TradingStats {
  total_trades: number;
  open_trades: number;
  total_vouches: number;
  top_vouches: LeaderRow[];
  top_trades: LeaderRow[];
}

const LABEL = "mb-2 block text-xs font-semibold text-discord-text-muted uppercase tracking-wide";
const CARD = "rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6";

function Leaderboard({ title, rows, field, unit }: { title: string; rows: LeaderRow[]; field: "up" | "trades"; unit: string }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className={CARD}>
      <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-discord-text-muted">Nothing yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={r.user_id} className="flex items-center justify-between text-sm">
              <span className="text-white">
                <span className="mr-2 inline-block w-6 text-discord-text-muted">{medals[i] ?? `#${i + 1}`}</span>
                {r.name || r.user_id}
              </span>
              <span className="font-semibold text-white">
                {r[field]} <span className="font-normal text-discord-text-muted">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function TradingPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [settings, setSettings] = useState<TradingSettings | null>(null);
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoState, setAutoState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef("");

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/trading`)
      .then((data: { settings: TradingSettings; stats: TradingStats }) => {
        lastSavedRef.current = JSON.stringify(data.settings);
        setSettings(data.settings);
        setStats(data.stats);
      })
      .catch(() => toast("Failed to load trading settings", "error"));
  }, [guildId, toast]);

  const save = (value: TradingSettings) =>
    fetchApi(`/guilds/${guildId}/trading`, undefined, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });

  // Auto-save 800ms after the last edit; an empty emoji is skipped (manual save explains why).
  useEffect(() => {
    if (!settings) return;
    const snapshot = JSON.stringify(settings);
    if (snapshot === lastSavedRef.current || !settings.emoji.trim()) return;

    const timer = setTimeout(async () => {
      setAutoState("saving");
      try {
        await save(settings);
        lastSavedRef.current = snapshot;
        setAutoState("saved");
      } catch {
        setAutoState("error");
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, guildId]);

  if (!settings) {
    return <div className="glass-card rounded-3xl p-6 text-discord-text-muted">Loading...</div>;
  }

  const update = <K extends keyof TradingSettings>(key: K, val: TradingSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: val } : prev));

  const handleSave = async () => {
    if (!settings.emoji.trim()) {
      toast("Trade emoji cannot be empty.", "error");
      return;
    }
    setSaving(true);
    try {
      await save(settings);
      lastSavedRef.current = JSON.stringify(settings);
      setAutoState("saved");
      toast("Trading settings saved!");
    } catch (e: any) {
      toast(e?.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={Handshake}
        title="Trading"
        subtitle="Members post in a trading channel, someone reacts, and the bot opens a private thread for the two traders. After the trade they vouch or downvote each other."
        stats={[
          { label: "Completed Trades", value: stats?.total_trades ?? 0 },
          { label: "Open Trades", value: stats?.open_trades ?? 0 },
          { label: "Total Vouches", value: stats?.total_vouches ?? 0 },
          { label: "Status", value: settings.enabled ? "Enabled" : "Disabled" },
        ]}
        actions={
          <>
            {autoState !== "idle" && (
              <span className={`text-xs ${autoState === "error" ? "text-red-400" : "text-green-400"}`}>
                {autoState === "saving" ? "Saving..." : autoState === "saved" ? "All changes saved" : "Auto-save failed"}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </>
        }
      />

      <div className={CARD}>
        <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">Channels</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Trading Channels</label>
            <ChannelMultiSelect
              guildId={guildId}
              value={settings.channel_ids}
              onChange={(ids) => update("channel_ids", ids)}
              placeholder="Channels where members post trades..."
            />
            <p className="mt-2 text-[10px] text-discord-text-muted">
              The bot adds the trade emoji to every message posted here.
            </p>
          </div>
          <div>
            <label className={LABEL}>Stats Channels</label>
            <ChannelMultiSelect
              guildId={guildId}
              value={settings.stats_channel_ids}
              onChange={(ids) => update("stats_channel_ids", ids)}
              placeholder="Anywhere"
            />
            <p className="mt-2 text-[10px] text-discord-text-muted">
              /trading stats and /trading top only work in these channels. Leave empty to allow them anywhere.
            </p>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">Threads & Staff</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Staff Roles (moderator, helper, support...)</label>
            <RoleMultiSelect
              guildId={guildId}
              value={settings.staff_role_ids}
              onChange={(ids) => update("staff_role_ids", ids)}
            />
            <p className="mt-2 text-[10px] text-discord-text-muted">
              These roles are added to every trade thread. Each role must be mentionable, or the bot needs the
              Mention Everyone permission.
            </p>
          </div>
          <div>
            <label className={LABEL}>Trade Emoji</label>
            <Input value={settings.emoji} onChange={(e) => update("emoji", e.target.value)} placeholder="🤝" />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => update("enabled", e.target.checked)} />
          Trading enabled
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Leaderboard title="Top Vouches" rows={stats?.top_vouches ?? []} field="up" unit="vouches" />
        <Leaderboard title="Top Successful Trades" rows={stats?.top_trades ?? []} field="trades" unit="trades" />
      </div>
    </div>
  );
}

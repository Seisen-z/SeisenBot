"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { RefreshCcwIcon, UsersIcon } from "lucide-react";

type CounterChannelType = "voice" | "text";

interface MemberCounterConfig {
  enabled: boolean;
  channel_id: string;
  channel_type: CounterChannelType;
  category_id: string;
  prefix: string;
  include_bots: boolean;
  last_count: number;
  last_updated: string | null;
  created_at: string | null;
  created_by: string | null;
}

const DEFAULT_CONFIG: MemberCounterConfig = {
  enabled: false,
  channel_id: "",
  channel_type: "voice",
  category_id: "",
  prefix: "Members: ",
  include_bots: false,
  last_count: 0,
  last_updated: null,
  created_at: null,
  created_by: null,
};

function normalizeCounterConfig(raw: any): MemberCounterConfig {
  const channelType: CounterChannelType = String(raw?.channel_type || "voice").toLowerCase() === "text" ? "text" : "voice";
  const prefix = String(raw?.prefix || "Members: ").slice(0, 90);

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    enabled: Boolean(raw?.enabled),
    channel_id: String(raw?.channel_id || ""),
    channel_type: channelType,
    category_id: String(raw?.category_id || ""),
    prefix: prefix || "Members: ",
    include_bots: Boolean(raw?.include_bots),
    last_count: Math.max(0, Number(raw?.last_count || 0)),
    last_updated: raw?.last_updated ? String(raw.last_updated) : null,
    created_at: raw?.created_at ? String(raw.created_at) : null,
    created_by: raw?.created_by ? String(raw.created_by) : null,
  };
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "Never";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Never";
  return dt.toLocaleString();
}

export default function MemberCounterPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [config, setConfig] = useState<MemberCounterConfig>(DEFAULT_CONFIG);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
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
        // Ignore auth fetch errors for this page.
      });
  }, []);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/member_counter`)
      .then((data) => setConfig(normalizeCounterConfig(data)))
      .catch(() => toast("Failed to load member counter config", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistConfig = useCallback(async (nextConfig: MemberCounterConfig) => {
    await fetchApi(`/guilds/${guildId}/member_counter`, undefined, {
      method: "PUT",
      body: JSON.stringify({
        enabled: Boolean(nextConfig.enabled),
        channel_id: nextConfig.channel_id || null,
        channel_type: nextConfig.channel_type === "text" ? "text" : "voice",
        category_id: nextConfig.category_id || null,
        prefix: String(nextConfig.prefix || "Members: ").slice(0, 90),
        include_bots: Boolean(nextConfig.include_bots),
        last_count: Math.max(0, Number(nextConfig.last_count || 0)),
        last_updated: nextConfig.last_updated || null,
        created_at: nextConfig.created_at || null,
        created_by: nextConfig.created_by || null,
      }),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: () => toast("Auto-save failed for member counter", "error"),
  });

  const updateConfig = (patch: Partial<MemberCounterConfig>) => {
    setConfig((prev) => normalizeCounterConfig({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Member counter config saved!");
    } catch {
      toast("Failed to save member counter config", "error");
    } finally {
      setSaving(false);
    }
  };

  const createCounterChannel = async () => {
    setCreating(true);
    try {
      const response = await fetchApi("/trigger/create_member_counter_channel", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_type: config.channel_type,
            prefix: config.prefix,
            include_bots: config.include_bots,
            category_id: config.category_id || null,
            created_by_user_id: currentUserId || undefined,
          },
        }),
      });

      if (response?.config) {
        setConfig(normalizeCounterConfig(response.config));
      } else {
        const latest = await fetchApi(`/guilds/${guildId}/member_counter`);
        setConfig(normalizeCounterConfig(latest));
      }

      toast("Member counter channel created!");
    } catch (err: any) {
      toast(`Failed to create counter channel: ${err.message}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const syncCounterNow = async () => {
    setSyncing(true);
    try {
      const response = await fetchApi("/trigger/sync_member_counter", undefined, {
        method: "POST",
        body: JSON.stringify({ guild_id: guildId, payload: {} }),
      });

      if (response?.config) {
        setConfig(normalizeCounterConfig(response.config));
      } else {
        const latest = await fetchApi(`/guilds/${guildId}/member_counter`);
        setConfig(normalizeCounterConfig(latest));
      }

      toast("Member counter synced.");
    } catch (err: any) {
      toast(`Failed to sync counter: ${err.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  const previewName = `${config.prefix || "Members: "}${Math.max(0, Number(config.last_count || 0))}`.slice(0, 100);

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={UsersIcon}
        title="Realtime Member Counter"
        subtitle="Create or link a channel that updates automatically with your server member count from both bot and dashboard controls."
        stats={[
          { label: "Enabled", value: config.enabled ? "Yes" : "No" },
          { label: "Channel", value: config.channel_id ? "Linked" : "Missing" },
          { label: "Counter", value: Math.max(0, Number(config.last_count || 0)) },
          { label: "Type", value: config.channel_type === "text" ? "Text" : "Voice" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button variant="outline" onClick={syncCounterNow} disabled={syncing || !config.channel_id} className="inline-flex items-center gap-2">
              <RefreshCcwIcon className="h-4 w-4" />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button onClick={createCounterChannel} disabled={creating}>
              {creating ? "Creating..." : "Create Counter Channel"}
            </Button>
            <Button variant="discord" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#202225]/80 p-3">
              <div>
                <p className="text-sm font-semibold text-white">Enable Realtime Counter</p>
                <p className="text-xs text-discord-text-muted">Updates on joins/leaves and periodic sync loop.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-[#111827] text-discord-blurple"
                  checked={config.enabled}
                  onChange={(e) => updateConfig({ enabled: e.target.checked })}
                />
              </label>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Counter Channel (Existing)</label>
              <ChannelSelect
                guildId={guildId}
                value={config.channel_id || ""}
                onChange={(id) => updateConfig({ channel_id: id, enabled: true })}
                types={[0, 2]}
                placeholder="Select a text or voice channel..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Create Channel Type</label>
                <select
                  value={config.channel_type}
                  onChange={(e) => updateConfig({ channel_type: e.target.value === "text" ? "text" : "voice" })}
                  className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm text-discord-text outline-none transition focus:border-discord-blurple"
                >
                  <option value="voice">Voice</option>
                  <option value="text">Text</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Create Category (Optional)</label>
                <ChannelSelect
                  guildId={guildId}
                  value={config.category_id || ""}
                  onChange={(id) => updateConfig({ category_id: id })}
                  types={[4]}
                  includeCategories
                  placeholder="No category"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Name Prefix</label>
              <Input
                value={config.prefix}
                onChange={(e) => updateConfig({ prefix: e.target.value.slice(0, 90) })}
                placeholder="Members: "
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#202225]/80 p-3">
              <div>
                <p className="text-sm font-semibold text-white">Include Bots</p>
                <p className="text-xs text-discord-text-muted">When enabled, bot accounts are included in the count.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-[#111827] text-discord-blurple"
                  checked={config.include_bots}
                  onChange={(e) => updateConfig({ include_bots: e.target.checked })}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1E1F22] bg-[#2f3136] p-4 shadow-inner">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-discord-text-muted">Live Preview</p>
          <div className="rounded-xl border border-white/10 bg-[#36393f] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#b5bac1]">Channel Name</p>
            <p className="mt-2 text-lg font-bold text-[#f2f3f5]">{previewName}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#b5bac1]">
              <div className="rounded-md bg-[#4a4d57] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#c8ccd2]">Last Count</p>
                <p className="mt-1 font-semibold text-[#f2f3f5]">{Math.max(0, Number(config.last_count || 0))}</p>
              </div>
              <div className="rounded-md bg-[#4a4d57] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#c8ccd2]">Last Update</p>
                <p className="mt-1 font-semibold text-[#f2f3f5]">{formatTimestamp(config.last_updated)}</p>
              </div>
            </div>

            <div className="mt-4 text-xs text-[#b5bac1]">
              Status: {config.enabled ? "Enabled" : "Disabled"} • {config.channel_type === "text" ? "Text Channel" : "Voice Channel"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

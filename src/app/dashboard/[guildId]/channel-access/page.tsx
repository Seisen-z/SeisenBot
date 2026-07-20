"use client";

import { use, useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { KeyRoundIcon, RefreshCcwIcon, PlusIcon, TrashIcon } from "lucide-react";

type ChannelAccessMapping = {
  id: string;
  role_id: string;
  channel_id: string;
  view_channel: boolean;
  send_messages: boolean;
};

type ChannelAccessConfig = {
  enabled: boolean;
  mappings: ChannelAccessMapping[];
};

const DEFAULT_CONFIG: ChannelAccessConfig = {
  enabled: true,
  mappings: [],
};

function makeMappingId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChannelAccessPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<ChannelAccessConfig>(DEFAULT_CONFIG);

  const loadAll = async (silent = false) => {
    try {
      const cfg = await fetchApi(`/guilds/${guildId}/channel_access`);
      setConfig({
        ...DEFAULT_CONFIG,
        ...cfg,
        mappings: Array.isArray(cfg?.mappings) ? cfg.mappings : [],
      });
    } catch (err: any) {
      if (!silent) toast(`Failed to load channel access settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const next: ChannelAccessConfig = {
        ...config,
        mappings: config.mappings.filter((m) => m.role_id && m.channel_id),
      };
      const result = await fetchApi(`/guilds/${guildId}/channel_access`, undefined, {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setConfig(next);
      const applied = Number(result?.sync?.applied || 0);
      const failed = Number(result?.sync?.failed || 0);
      if (failed > 0) {
        toast(`Saved, but ${failed} mapping(s) failed to sync (check the role/channel still exist).`, "error");
      } else {
        toast(`Saved and synced ${applied} mapping(s) to Discord.`);
      }
    } catch (err: any) {
      toast(`Failed to save settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await fetchApi(`/guilds/${guildId}/channel_access/sync`, undefined, { method: "POST" });
      const applied = Number(result?.applied || 0);
      const failed = Number(result?.failed || 0);
      toast(failed > 0 ? `Synced ${applied} mapping(s), ${failed} failed.` : `Synced ${applied} mapping(s).`);
    } catch (err: any) {
      toast(`Sync failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  const addMapping = () => {
    setConfig((prev) => ({
      ...prev,
      mappings: [
        ...prev.mappings,
        { id: makeMappingId(), role_id: "", channel_id: "", view_channel: true, send_messages: true },
      ],
    }));
  };

  const updateMapping = (id: string, patch: Partial<ChannelAccessMapping>) => {
    setConfig((prev) => ({
      ...prev,
      mappings: prev.mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  };

  const removeMapping = (id: string) => {
    setConfig((prev) => ({ ...prev, mappings: prev.mappings.filter((m) => m.id !== id) }));
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={KeyRoundIcon}
        title="Channel Access"
        subtitle="Map roles to channels. Anyone holding a mapped role automatically sees (and can post in) the mapped channel — Discord enforces this natively once synced, so it works for every current and future holder of that role."
        stats={[{ label: "Mappings", value: config.mappings.length }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => loadAll(false)}>
              <RefreshCcwIcon className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={syncNow} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button variant="discord" onClick={saveConfig} disabled={saving}>
              {saving ? "Saving..." : "Save & Sync"}
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Mappings</h3>
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={addMapping}>
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Mapping
          </Button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-discord-text-muted">Loading...</p>
        ) : config.mappings.length === 0 ? (
          <p className="mt-3 text-sm text-discord-text-muted">
            No mappings yet. Add one to unlock a channel for a role, e.g. the OG role → the OG-only lounge.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {config.mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end"
              >
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-discord-text-muted">Role</span>
                  <RoleSelect
                    guildId={guildId}
                    value={mapping.role_id}
                    onChange={(id) => updateMapping(mapping.id, { role_id: id })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-discord-text-muted">Channel</span>
                  <ChannelSelect
                    guildId={guildId}
                    value={mapping.channel_id}
                    onChange={(id) => updateMapping(mapping.id, { channel_id: id })}
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs text-discord-text">
                  <input
                    type="checkbox"
                    checked={mapping.view_channel}
                    onChange={(e) => updateMapping(mapping.id, { view_channel: e.target.checked })}
                    className="h-4 w-4 accent-[#a3a7b0]"
                  />
                  Can View
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs text-discord-text">
                  <input
                    type="checkbox"
                    checked={mapping.send_messages}
                    onChange={(e) => updateMapping(mapping.id, { send_messages: e.target.checked })}
                    className="h-4 w-4 accent-[#a3a7b0]"
                  />
                  Can Send
                </label>
                <Button
                  variant="outline"
                  className="h-10 px-3 text-red-400 hover:text-red-300"
                  onClick={() => removeMapping(mapping.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

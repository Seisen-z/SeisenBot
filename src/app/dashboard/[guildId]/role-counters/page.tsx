"use client";

import { use, useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChannelSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { UsersIcon, PlusIcon, Trash2Icon, RefreshCcwIcon, SendIcon, RefreshCwIcon } from "lucide-react";

type RolePanel = {
  id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  role_ids: string[];
  enabled: boolean;
  last_updated: string | null;
};

type Draft = {
  channel_id: string;
  title: string;
  role_ids: string[];
};

const EMPTY_DRAFT: Draft = {
  channel_id: "",
  title: "Role Members",
  role_ids: [],
};

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Never" : d.toLocaleString();
}

export default function RoleCountersPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [panels, setPanels] = useState<RolePanel[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = async (silent = false) => {
    try {
      const data = await fetchApi(`/guilds/${guildId}/role_counters`);
      setPanels(Array.isArray(data?.panels) ? data.panels : []);
    } catch (err: any) {
      if (!silent) toast(`Failed to load panels: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const createPanel = async () => {
    if (!draft.channel_id) { toast("Select a channel.", "error"); return; }
    if (draft.role_ids.length === 0) { toast("Select at least one role.", "error"); return; }
    setCreating(true);
    try {
      await fetchApi(`/guilds/${guildId}/role_counters`, undefined, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      toast("Panel created. Click Post to send it to Discord.");
      setDraft(EMPTY_DRAFT);
      await load(true);
    } catch (err: any) {
      toast(`Failed to create panel: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const postPanel = async (panel: RolePanel) => {
    setBusy((p) => ({ ...p, [`post_${panel.id}`]: true }));
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${panel.id}/post`, undefined, { method: "POST" });
      toast("Panel posted to Discord.");
      await load(true);
    } catch (err: any) {
      toast(`Failed to post panel: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((p) => ({ ...p, [`post_${panel.id}`]: false }));
    }
  };

  const syncPanel = async (panel: RolePanel) => {
    setBusy((p) => ({ ...p, [`sync_${panel.id}`]: true }));
    try {
      const res = await fetchApi(`/guilds/${guildId}/role_counters/${panel.id}/sync`, undefined, { method: "POST" });
      toast(res?.message || "Synced.");
      await load(true);
    } catch (err: any) {
      toast(`Sync failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((p) => ({ ...p, [`sync_${panel.id}`]: false }));
    }
  };

  const updatePanelRoles = async (panel: RolePanel, role_ids: string[]) => {
    setBusy((p) => ({ ...p, [`roles_${panel.id}`]: true }));
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${panel.id}`, undefined, {
        method: "PUT",
        body: JSON.stringify({ ...panel, role_ids }),
      });
      await load(true);
    } catch (err: any) {
      toast(`Failed to update roles: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((p) => ({ ...p, [`roles_${panel.id}`]: false }));
    }
  };

  const updatePanelTitle = async (panel: RolePanel, title: string) => {
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${panel.id}`, undefined, {
        method: "PUT",
        body: JSON.stringify({ ...panel, title }),
      });
      await load(true);
    } catch {
      // silent
    }
  };

  const toggleEnabled = async (panel: RolePanel) => {
    setBusy((p) => ({ ...p, [panel.id]: true }));
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${panel.id}`, undefined, {
        method: "PUT",
        body: JSON.stringify({ ...panel, enabled: !panel.enabled }),
      });
      await load(true);
    } catch (err: any) {
      toast(`Failed to toggle: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((p) => ({ ...p, [panel.id]: false }));
    }
  };

  const deletePanel = async (panel: RolePanel) => {
    setBusy((p) => ({ ...p, [`del_${panel.id}`]: true }));
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${panel.id}`, undefined, { method: "DELETE" });
      toast("Panel deleted.");
      await load(true);
    } catch (err: any) {
      toast(`Failed to delete panel: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((p) => ({ ...p, [`del_${panel.id}`]: false }));
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={UsersIcon}
        title="Role Count Panels"
        subtitle="Post an embed to any channel showing how many members hold each role. The embed auto-updates whenever a role is added or removed from a member."
        stats={[
          { label: "Panels", value: panels.length },
          { label: "Active", value: panels.filter((p) => p.enabled && p.message_id).length },
        ]}
        actions={
          <Button variant="outline" onClick={() => load(false)}>
            <RefreshCcwIcon className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Create form */}
      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Create New Panel</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Post to Channel</span>
            <ChannelSelect
              guildId={guildId}
              value={draft.channel_id}
              onChange={(val) => setDraft((p) => ({ ...p, channel_id: val }))}
              types={[0, 5]}
              placeholder="Select a channel..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Panel Title</span>
            <Input
              value={draft.title}
              maxLength={100}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="Role Members"
            />
          </label>

          <label className="space-y-2 sm:col-span-2 xl:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Roles to Track</span>
            <RoleMultiSelect
              guildId={guildId}
              value={draft.role_ids}
              onChange={(ids) => setDraft((p) => ({ ...p, role_ids: ids }))}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="discord"
            onClick={createPanel}
            disabled={creating || !draft.channel_id || draft.role_ids.length === 0}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            {creating ? "Creating..." : "Create Panel"}
          </Button>
          <p className="text-xs text-discord-text-muted">
            After creating, click <span className="text-white">Post to Discord</span> to send the embed.
          </p>
        </div>
      </div>

      {/* Existing panels */}
      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Existing Panels</h3>

        {loading ? (
          <p className="text-sm text-discord-text-muted">Loading...</p>
        ) : panels.length === 0 ? (
          <p className="text-sm text-discord-text-muted">No panels yet. Create one above.</p>
        ) : (
          <div className="space-y-4">
            {panels.map((panel) => (
              <div key={panel.id} className="rounded-lg border border-white/10 bg-white/5 p-4">

                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-48 text-sm font-semibold"
                      defaultValue={panel.title}
                      maxLength={100}
                      onBlur={(e) => {
                        if (e.target.value !== panel.title) updatePanelTitle(panel, e.target.value);
                      }}
                    />
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${panel.enabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {panel.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {panel.message_id ? (
                      <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">Posted</span>
                    ) : (
                      <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">Not Posted</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="discord"
                      className="h-8 px-3 text-xs"
                      disabled={busy[`post_${panel.id}`]}
                      onClick={() => postPanel(panel)}
                    >
                      <SendIcon className="mr-1.5 h-3.5 w-3.5" />
                      {busy[`post_${panel.id}`] ? "Posting..." : panel.message_id ? "Re-post" : "Post to Discord"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={busy[`sync_${panel.id}`] || !panel.message_id}
                      onClick={() => syncPanel(panel)}
                    >
                      <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5" />
                      {busy[`sync_${panel.id}`] ? "Syncing..." : "Sync"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={busy[panel.id]}
                      onClick={() => toggleEnabled(panel)}
                    >
                      {busy[panel.id] ? "..." : panel.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 px-2 text-xs text-red-400 hover:border-red-500/50 hover:text-red-300"
                      disabled={busy[`del_${panel.id}`]}
                      onClick={() => deletePanel(panel)}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Channel + last update */}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-discord-text-muted">
                  <span>Channel: <span className="font-mono text-white/70">{panel.channel_id}</span></span>
                  {panel.message_id && <span>Message: <span className="font-mono text-white/70">{panel.message_id}</span></span>}
                  <span>Last updated: <span className="text-white/70">{formatDate(panel.last_updated)}</span></span>
                </div>

                {/* Role multi-select */}
                <div className="mt-3 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Tracked Roles</span>
                  <RoleMultiSelect
                    guildId={guildId}
                    value={panel.role_ids}
                    onChange={(ids) => updatePanelRoles(panel, ids)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

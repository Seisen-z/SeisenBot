"use client";

import { use, useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { UsersIcon, PlusIcon, Trash2Icon, RefreshCcwIcon } from "lucide-react";

type RoleCounter = {
  id: string;
  role_id: string;
  channel_id: string;
  prefix: string;
  enabled: boolean;
  last_count: number;
  last_updated?: string | null;
};

type DraftCounter = Omit<RoleCounter, "id" | "last_count" | "last_updated">;

const EMPTY_DRAFT: DraftCounter = {
  role_id: "",
  channel_id: "",
  prefix: "Members: ",
  enabled: true,
};

function formatDate(value?: string | null): string {
  if (!value) return "Never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Never" : d.toLocaleString();
}

export default function RoleCountersPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<RoleCounter[]>([]);
  const [draft, setDraft] = useState<DraftCounter>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = async (silent = false) => {
    try {
      const data = await fetchApi(`/guilds/${guildId}/role_counters`);
      setCounters(Array.isArray(data?.counters) ? data.counters : []);
    } catch (err: any) {
      if (!silent) toast(`Failed to load role counters: ${err?.message || "Unknown error"}`, "error");
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

  const addCounter = async () => {
    if (!draft.role_id || !draft.channel_id) {
      toast("Please select a role and a channel.", "error");
      return;
    }
    setAdding(true);
    try {
      await fetchApi(`/guilds/${guildId}/role_counters`, undefined, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      toast("Role counter created.");
      setDraft(EMPTY_DRAFT);
      await load(true);
    } catch (err: any) {
      toast(`Failed to create counter: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setAdding(false);
    }
  };

  const toggleEnabled = async (counter: RoleCounter) => {
    setBusy((prev) => ({ ...prev, [counter.id]: true }));
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${counter.id}`, undefined, {
        method: "PUT",
        body: JSON.stringify({ ...counter, enabled: !counter.enabled }),
      });
      await load(true);
    } catch (err: any) {
      toast(`Failed to update counter: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((prev) => ({ ...prev, [counter.id]: false }));
    }
  };

  const updatePrefix = async (counter: RoleCounter, prefix: string) => {
    setBusy((prev) => ({ ...prev, [`prefix_${counter.id}`]: true }));
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${counter.id}`, undefined, {
        method: "PUT",
        body: JSON.stringify({ ...counter, prefix }),
      });
      await load(true);
    } catch (err: any) {
      toast(`Failed to update prefix: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((prev) => ({ ...prev, [`prefix_${counter.id}`]: false }));
    }
  };

  const syncCounter = async (counter: RoleCounter) => {
    setBusy((prev) => ({ ...prev, [`sync_${counter.id}`]: true }));
    try {
      const res = await fetchApi(`/guilds/${guildId}/role_counters/${counter.id}/sync`, undefined, { method: "POST" });
      toast(res?.message || "Synced.");
      await load(true);
    } catch (err: any) {
      toast(`Sync failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((prev) => ({ ...prev, [`sync_${counter.id}`]: false }));
    }
  };

  const deleteCounter = async (counter: RoleCounter) => {
    setBusy((prev) => ({ ...prev, [`del_${counter.id}`]: true }));
    try {
      await fetchApi(`/guilds/${guildId}/role_counters/${counter.id}`, undefined, { method: "DELETE" });
      toast("Counter removed.");
      await load(true);
    } catch (err: any) {
      toast(`Failed to delete counter: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setBusy((prev) => ({ ...prev, [`del_${counter.id}`]: false }));
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={UsersIcon}
        title="Role Counters"
        subtitle="Auto-updating channel names that show how many members hold a specific role. Updates instantly when roles are assigned or removed."
        stats={[{ label: "Active Counters", value: counters.filter((c) => c.enabled).length }]}
        actions={
          <Button variant="outline" onClick={() => load(false)}>
            <RefreshCcwIcon className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Add new counter */}
      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Add New Counter</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Role</span>
            <RoleSelect
              guildId={guildId}
              value={draft.role_id}
              onChange={(val) => setDraft((prev) => ({ ...prev, role_id: val }))}
              placeholder="Select a role..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Channel</span>
            <ChannelSelect
              guildId={guildId}
              value={draft.channel_id}
              onChange={(val) => setDraft((prev) => ({ ...prev, channel_id: val }))}
              types={[2, 0]}
              placeholder="Select a channel..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Prefix</span>
            <Input
              value={draft.prefix}
              maxLength={90}
              onChange={(e) => setDraft((prev) => ({ ...prev, prefix: e.target.value }))}
              placeholder="Members: "
            />
          </label>

          <div className="flex items-end">
            <Button
              variant="discord"
              className="w-full"
              onClick={addCounter}
              disabled={adding || !draft.role_id || !draft.channel_id}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              {adding ? "Adding..." : "Add Counter"}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-discord-text-muted">
          The channel name will become <span className="font-mono text-white/70">{(draft.prefix || "Members: ").trim()} {"<count>"}</span>. Use a voice channel to prevent members from joining it.
        </p>
      </div>

      {/* Existing counters */}
      <div className="rounded-xl border border-white/10 bg-[#202225]/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Configured Counters</h3>
        {loading ? (
          <p className="text-sm text-discord-text-muted">Loading...</p>
        ) : counters.length === 0 ? (
          <p className="text-sm text-discord-text-muted">No role counters configured yet.</p>
        ) : (
          <div className="space-y-3">
            {counters.map((counter) => (
              <div
                key={counter.id}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div className="flex flex-wrap items-start gap-3">
                  {/* Info block */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-[#5865F2]/20 px-2 py-0.5 font-mono text-[#7289da]">
                        role: {counter.role_id}
                      </span>
                      <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-white/70">
                        ch: {counter.channel_id}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 font-semibold ${
                          counter.enabled
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {counter.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-discord-text-muted">
                      <span>
                        Count: <span className="text-white">{counter.last_count}</span>
                      </span>
                      <span>
                        Updated: <span className="text-white">{formatDate(counter.last_updated)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Prefix edit */}
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-36 text-xs"
                      value={counter.prefix}
                      maxLength={90}
                      onChange={(e) => {
                        setCounters((prev) =>
                          prev.map((c) => (c.id === counter.id ? { ...c, prefix: e.target.value } : c))
                        );
                      }}
                      onBlur={(e) => {
                        if (e.target.value !== counter.prefix) {
                          updatePrefix(counter, e.target.value);
                        }
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={busy[`sync_${counter.id}`]}
                      onClick={() => syncCounter(counter)}
                    >
                      {busy[`sync_${counter.id}`] ? "Syncing..." : "Sync Now"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={busy[counter.id]}
                      onClick={() => toggleEnabled(counter)}
                    >
                      {busy[counter.id] ? "..." : counter.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 px-2 text-xs text-red-400 hover:border-red-500/50 hover:text-red-300"
                      disabled={busy[`del_${counter.id}`]}
                      onClick={() => deleteCounter(counter)}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

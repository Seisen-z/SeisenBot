"use client";

import { use, useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, ChannelMultiSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { ShieldBanIcon, RefreshCcwIcon } from "lucide-react";

type TrapChannelConfig = {
  enabled: boolean;
  channel_ids: string[];
  action: "kick" | "ban";
  delete_message_hours: number;
  exempt_role_ids: string[];
  delete_trigger_message: boolean;
  reason: string;
  log_channel_id: string | null;
};

const DEFAULT_CONFIG: TrapChannelConfig = {
  enabled: true,
  channel_ids: [],
  action: "kick",
  delete_message_hours: 6,
  exempt_role_ids: [],
  delete_trigger_message: true,
  reason: "Posted in a restricted channel",
  log_channel_id: null,
};

export default function TrapChannelsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<TrapChannelConfig>(DEFAULT_CONFIG);

  const loadConfig = async (silent = false) => {
    try {
      const cfg = await fetchApi(`/guilds/${guildId}/trap_channels`);
      setConfig({
        ...DEFAULT_CONFIG,
        ...cfg,
        channel_ids: Array.isArray(cfg?.channel_ids) ? cfg.channel_ids : [],
        exempt_role_ids: Array.isArray(cfg?.exempt_role_ids) ? cfg.exempt_role_ids : [],
      });
    } catch (err: any) {
      if (!silent) toast(`Failed to load trap channel settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const next: TrapChannelConfig = {
        ...config,
        delete_message_hours: Math.max(0, Math.min(168, Number(config.delete_message_hours || 0))),
        reason: config.reason?.trim() || DEFAULT_CONFIG.reason,
      };
      await fetchApi(`/guilds/${guildId}/trap_channels`, undefined, {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setConfig(next);
      toast("Trap channel settings saved.");
    } catch (err: any) {
      toast(`Failed to save settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={ShieldBanIcon}
        title="Trap Channels"
        subtitle="Anyone (other than exempt roles or server admins) who sends a message in one of these channels is immediately kicked or banned, and their recent messages are purged from the server. Use this for honeypot/no-post channels, not channels real members are meant to use."
        stats={[
          { label: "Trap Channels", value: config.channel_ids.length },
          { label: "Action", value: config.action === "ban" ? "Ban" : "Kick" },
          { label: "Purge Window", value: `${config.delete_message_hours}h` },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => loadConfig(false)}>
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
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Action</span>
          <select
            value={config.action}
            onChange={(e) => setConfig((prev) => ({ ...prev, action: e.target.value as "kick" | "ban" }))}
            className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm outline-none transition focus:border-white/30 text-discord-text"
          >
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">
            Purge Window (Hours, max 168 = 7 days)
          </span>
          <Input
            type="number"
            min={0}
            max={168}
            value={config.delete_message_hours}
            onChange={(e) => setConfig((prev) => ({ ...prev, delete_message_hours: Number(e.target.value || 0) }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Delete Triggering Message</span>
          <select
            value={config.delete_trigger_message ? "1" : "0"}
            onChange={(e) => setConfig((prev) => ({ ...prev, delete_trigger_message: e.target.value === "1" }))}
            className="h-10 w-full rounded-md border border-[#1E1F22] bg-[#1f2023] px-3 text-sm outline-none transition focus:border-white/30 text-discord-text"
          >
            <option value="1">Delete it</option>
            <option value="0">Leave it</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Log Channel (optional)</span>
          <ChannelSelect
            guildId={guildId}
            value={config.log_channel_id || ""}
            onChange={(val) => setConfig((prev) => ({ ...prev, log_channel_id: val || null }))}
            placeholder="No logging channel..."
          />
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Trap Channels</span>
          <ChannelMultiSelect
            guildId={guildId}
            value={config.channel_ids}
            onChange={(ids) => setConfig((prev) => ({ ...prev, channel_ids: ids }))}
            types={[0, 2, 5, 13, 15]}
            placeholder="Select one or more channels to trap..."
          />
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">
            Exempt Roles <span className="normal-case text-[10px] text-discord-text-muted">(server admins are always exempt automatically)</span>
          </span>
          <RoleMultiSelect
            guildId={guildId}
            value={config.exempt_role_ids}
            onChange={(ids) => setConfig((prev) => ({ ...prev, exempt_role_ids: ids }))}
          />
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">Reason (shown in audit log)</span>
          <Textarea
            value={config.reason}
            onChange={(e) => setConfig((prev) => ({ ...prev, reason: e.target.value }))}
            rows={2}
          />
        </label>
      </div>

      {config.action === "kick" && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-discord-text-muted">
          Kick mode purges messages by searching every channel the bot can manage — this is best-effort and may miss
          some messages on large servers or hit rate limits. Ban mode uses Discord's native purge-on-ban, which is
          more reliable but shows as &quot;Banned&quot; in the audit log instead of &quot;Kicked&quot;.
        </div>
      )}
    </div>
  );
}

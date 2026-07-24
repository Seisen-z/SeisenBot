"use client";

import { use, useCallback, useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ChannelSelect, ChannelMultiSelect } from "@/components/ui/discord-selects";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { FileJson2Icon, RefreshCcwIcon } from "lucide-react";

type MacroImportConfig = {
  enabled: boolean;
  channel_ids: string[];
  storage_channel_id: string | null;
};

const DEFAULT_CONFIG: MacroImportConfig = {
  enabled: true,
  channel_ids: [],
  storage_channel_id: null,
};

export default function MacroImportPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [config, setConfig] = useState<MacroImportConfig>(DEFAULT_CONFIG);

  const loadConfig = async (silent = false) => {
    try {
      const cfg = await fetchApi(`/guilds/${guildId}/macro_import`);
      setConfig({
        ...DEFAULT_CONFIG,
        ...cfg,
        channel_ids: Array.isArray(cfg?.channel_ids) ? cfg.channel_ids : [],
      });
    } catch (err: any) {
      if (!silent) toast(`Failed to load macro import settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  useEffect(() => {
    loadConfig(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const persistConfig = useCallback(
    async (value: MacroImportConfig) => {
      await fetchApi(`/guilds/${guildId}/macro_import`, undefined, {
        method: "PUT",
        body: JSON.stringify(value),
      });
      setLastSaved(new Date());
    },
    [guildId]
  );

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: (err: any) => toast(err?.message || "Auto-save failed for Macro Import settings", "error"),
  });

  const saveConfig = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Macro import settings saved.");
    } catch (err: any) {
      toast(`Failed to save settings: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={FileJson2Icon}
        title="Macro Import"
        subtitle="When a member uploads a recognized macro .json file in one of these channels or forums, the bot replies with a Macro's File Import URL embed — the required units, the download link, and a button to re-host the file for a longer-lived link."
        stats={[
          { label: "Watched Channels", value: config.channel_ids.length },
          { label: "Status", value: config.enabled ? "Enabled" : "Disabled" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
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

        <label className="space-y-2 md:col-span-1 xl:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">
            Storage Channel <span className="normal-case text-[10px] text-discord-text-muted">(re-hosts the file when someone clicks &quot;Make Permanent&quot;)</span>
          </span>
          <ChannelSelect
            guildId={guildId}
            value={config.storage_channel_id || ""}
            onChange={(val) => setConfig((prev) => ({ ...prev, storage_channel_id: val || null }))}
            types={[0, 5]}
            placeholder="No storage channel set..."
          />
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-muted">
            Watched Channels &amp; Forums
          </span>
          <ChannelMultiSelect
            guildId={guildId}
            value={config.channel_ids}
            onChange={(ids) => setConfig((prev) => ({ ...prev, channel_ids: ids }))}
            types={[0, 5, 15]}
            placeholder="Select channels or forums to watch for macro uploads..."
          />
        </label>
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-discord-text-muted">
        Only files matching a known macro schema trigger a response — unrelated .json uploads in the same
        channels are left alone. Set a Storage Channel so the &quot;Upload Macro (Make the Import-URL Permanent)&quot;
        button has somewhere to re-post the file for a fresh link.
      </div>
    </div>
  );
}

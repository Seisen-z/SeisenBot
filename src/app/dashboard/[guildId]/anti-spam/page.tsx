"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api";
import { toDashboardErrorState, type DashboardErrorState } from "@/lib/dashboard-errors";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleMultiSelect, ChannelMultiSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { DashboardErrorBanner } from "@/components/ui/dashboard-error-banner";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { ShieldAlertIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AntiSpamConfig {
  enabled: boolean;
  threshold: number;
  window_seconds: number;
  action: "warn" | "timeout" | "kick" | "ban";
  timeout_minutes: number;
  delete_messages: boolean;
  log_channel_id: string;
  exempt_role_ids: string[];
  exempt_channel_ids: string[];
  dm_user_on_action: boolean;
  dm_message: string;
}

const DEFAULT_CONFIG: AntiSpamConfig = {
  enabled: false,
  threshold: 5,
  window_seconds: 5,
  action: "timeout",
  timeout_minutes: 10,
  delete_messages: true,
  log_channel_id: "",
  exempt_role_ids: [],
  exempt_channel_ids: [],
  dm_user_on_action: true,
  dm_message: "You were actioned in this server for sending too many messages too quickly (spam).",
};

function normalizeConfig(raw: any): AntiSpamConfig {
  const action = ["warn", "timeout", "kick", "ban"].includes(raw?.action)
    ? (raw.action as AntiSpamConfig["action"])
    : "timeout";
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    action,
    threshold: Math.max(1, Math.min(20, Number(raw?.threshold || 5))),
    window_seconds: Math.max(1, Math.min(30, Number(raw?.window_seconds || 5))),
    timeout_minutes: Math.max(1, Number(raw?.timeout_minutes || 10)),
    log_channel_id: String(raw?.log_channel_id || ""),
    exempt_role_ids: Array.isArray(raw?.exempt_role_ids) ? raw.exempt_role_ids.map(String) : [],
    exempt_channel_ids: Array.isArray(raw?.exempt_channel_ids) ? raw.exempt_channel_ids.map(String) : [],
    dm_message: String(raw?.dm_message || DEFAULT_CONFIG.dm_message),
  };
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 space-y-4">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AntiSpamPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [config, setConfig] = useState<AntiSpamConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState<DashboardErrorState | null>(null);

  const loadConfig = useCallback(() => {
    setLoadError(null);
    setInitialLoadComplete(false);
    fetchApi(`/guilds/${guildId}/anti-spam`)
      .then((data) => {
        setConfig(normalizeConfig(data || {}));
        setLastLoadedAt(new Date());
      })
      .catch((err: any) => {
        setLoadError(toDashboardErrorState(err, "Failed to load Anti-Spam settings."));
        toast(err?.message || "Failed to load Anti-Spam settings", "error");
      })
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const persistConfig = useCallback(
    async (next: AntiSpamConfig) => {
      await fetchApi(`/guilds/${guildId}/anti-spam`, undefined, {
        method: "PUT",
        body: JSON.stringify({
          ...next,
          log_channel_id: next.log_channel_id || null,
          timeout_minutes: Math.max(1, next.timeout_minutes),
          threshold: Math.max(1, next.threshold),
          window_seconds: Math.max(1, next.window_seconds),
        }),
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
    onError: (err: any) => toast(err?.message || "Auto-save failed for Anti-Spam settings", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Anti-Spam settings saved!");
    } catch (err: any) {
      toast(err?.message || "Failed to save Anti-Spam settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof AntiSpamConfig, value: any) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      {/* ── Hero ── */}
      <DashboardPageHero
        icon={ShieldAlertIcon}
        title="Anti-Spam"
        subtitle="Rate-limit users who send too many messages in a short window. Configure the threshold, action, and exempt channels or roles."
        stats={[
          { label: "Status", value: config.enabled ? "Active" : "Disabled" },
          { label: "Threshold", value: `${config.threshold} msgs / ${config.window_seconds}s` },
          { label: "Action", value: config.action.charAt(0).toUpperCase() + config.action.slice(1) },
          { label: "Exempt Channels", value: config.exempt_channel_ids.length },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            {lastLoadedAt && (
              <span className="text-xs text-discord-text-muted">
                Loaded {new Date().getTime() - lastLoadedAt.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        }
      />

      {loadError && (
        <DashboardErrorBanner
          message={loadError.message}
          onRetry={loadConfig}
          actionLabel={loadError.needsRelogin ? "Login" : undefined}
          actionHref={loadError.needsRelogin ? "/login" : undefined}
        />
      )}

      {/* ── General Settings ── */}
      <Section title="General Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            Enable Anti-Spam
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.delete_messages}
              onChange={(e) => update("delete_messages", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            Delete spam messages
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.dm_user_on_action}
              onChange={(e) => update("dm_user_on_action", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            DM user when actioned
          </label>
        </div>

        {/* Log channel */}
        <div>
          <label className="mb-2 block text-sm font-medium text-discord-text-muted">
            Log Channel <span className="text-discord-text-muted/60 font-normal">(optional)</span>
          </label>
          <ChannelSelect
            guildId={guildId}
            value={config.log_channel_id}
            onChange={(id) => update("log_channel_id", id)}
            placeholder="Select a channel for spam action logs…"
          />
        </div>

        {/* DM message */}
        {config.dm_user_on_action && (
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">DM Message</label>
            <Textarea
              value={config.dm_message}
              onChange={(e) => update("dm_message", e.target.value)}
              rows={2}
              placeholder="Message sent to the user when they are actioned for spamming…"
            />
          </div>
        )}
      </Section>

      {/* ── Detection Threshold ── */}
      <Section title="Detection Threshold">
        <p className="text-xs text-discord-text-muted/70 -mt-2">
          The bot triggers when a user sends <strong className="text-discord-text">threshold</strong> or more messages
          within the <strong className="text-discord-text">window</strong>. Adjust these to suit your server's normal chat pace.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">
              Threshold (messages) <span className="text-discord-text-muted/60 font-normal">1–20</span>
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={config.threshold}
              onChange={(e) => update("threshold", Math.max(1, Math.min(20, Number(e.target.value || 5))))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">
              Window (seconds) <span className="text-discord-text-muted/60 font-normal">1–30</span>
            </label>
            <Input
              type="number"
              min={1}
              max={30}
              value={config.window_seconds}
              onChange={(e) => update("window_seconds", Math.max(1, Math.min(30, Number(e.target.value || 5))))}
            />
          </div>
        </div>
        <p className="text-xs text-discord-text-muted/50">
          Current setting: action triggers if a user sends <strong className="text-discord-text-muted">{config.threshold}</strong> messages
          within <strong className="text-discord-text-muted">{config.window_seconds}</strong> second{config.window_seconds !== 1 ? "s" : ""}.
        </p>
      </Section>

      {/* ── Action ── */}
      <Section title="Action">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Action on Spam</label>
            <select
              value={config.action}
              onChange={(e) => update("action", e.target.value as AntiSpamConfig["action"])}
              className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
            >
              <option value="warn">⚠️ Warn only (DM, no punishment)</option>
              <option value="timeout">⏱️ Timeout user</option>
              <option value="kick">👢 Kick user</option>
              <option value="ban">🔨 Ban user</option>
            </select>
          </div>

          {config.action === "timeout" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-discord-text-muted">
                Timeout Duration (minutes)
              </label>
              <Input
                type="number"
                min={1}
                max={40320}
                value={config.timeout_minutes}
                onChange={(e) => update("timeout_minutes", Math.max(1, Number(e.target.value || 10)))}
              />
            </div>
          )}
        </div>
      </Section>

      {/* ── Exemptions ── */}
      <Section title="Exemptions">
        <p className="text-xs text-discord-text-muted/70 -mt-2">
          Users with any exempt role, or messages posted in any exempt channel, will never be flagged for spam.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Exempt Roles</label>
            <RoleMultiSelect
              guildId={guildId}
              value={config.exempt_role_ids}
              onChange={(ids) => update("exempt_role_ids", ids)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Exempt Channels</label>
            <ChannelMultiSelect
              guildId={guildId}
              value={config.exempt_channel_ids}
              onChange={(ids) => update("exempt_channel_ids", ids)}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api";
import { toDashboardErrorState, type DashboardErrorState } from "@/lib/dashboard-errors";
import { useToast } from "@/components/ui/toast";
import { RoleMultiSelect, ChannelMultiSelect, ChannelSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { DashboardErrorBanner } from "@/components/ui/dashboard-error-banner";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { AtSignIcon, PlusIcon, XIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PingProtectionConfig {
  enabled: boolean;
  protected_user_ids: string[];
  protect_admins: boolean;
  protected_role_ids: string[];
  exempt_role_ids: string[];
  exempt_channel_ids: string[];
  delete_message: boolean;
  log_channel_id: string;
  dm_user_on_warn: boolean;
  warn_message: string;
}

const DEFAULT_CONFIG: PingProtectionConfig = {
  enabled: false,
  protected_user_ids: [],
  protect_admins: true,
  protected_role_ids: [],
  exempt_role_ids: [],
  exempt_channel_ids: [],
  delete_message: false,
  log_channel_id: "",
  dm_user_on_warn: true,
  warn_message: "⚠️ Please avoid unnecessarily pinging staff/admins. This is a warning.",
};

function normalizeConfig(raw: any): PingProtectionConfig {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    protected_user_ids: Array.isArray(raw?.protected_user_ids) ? raw.protected_user_ids.map(String) : [],
    protected_role_ids: Array.isArray(raw?.protected_role_ids) ? raw.protected_role_ids.map(String) : [],
    exempt_role_ids: Array.isArray(raw?.exempt_role_ids) ? raw.exempt_role_ids.map(String) : [],
    exempt_channel_ids: Array.isArray(raw?.exempt_channel_ids) ? raw.exempt_channel_ids.map(String) : [],
    log_channel_id: String(raw?.log_channel_id || ""),
    warn_message: String(raw?.warn_message || DEFAULT_CONFIG.warn_message),
  };
}

// ── User ID tag input ─────────────────────────────────────────────────────────

function UserIdInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!/^\d{15,22}$/.test(v)) {
      setError("Enter a valid Discord user ID (numbers only).");
      return;
    }
    if (values.includes(v)) {
      setDraft("");
      setError("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
    setError("");
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-discord-text-muted">Protected User IDs</label>
      <p className="mb-2 text-xs text-discord-text-muted/70">
        Anyone who @mentions one of these users will be warned. Enable Developer Mode in Discord, then
        right-click a user and choose "Copy User ID".
      </p>
      <div className="flex gap-2 mb-1">
        <Input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. 123456789012345678"
          className="font-mono text-xs"
        />
        <Button onClick={add} className="shrink-0 gap-1">
          <PlusIcon className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {values.length > 0 && (
        <div className="space-y-1 mt-2">
          {values.map((v) => (
            <div key={v} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-discord-text">
              <span className="truncate">{v}</span>
              <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-discord-text-muted hover:text-red-400 shrink-0">
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

export default function PingProtectionPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [config, setConfig] = useState<PingProtectionConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState<DashboardErrorState | null>(null);

  const loadConfig = useCallback(() => {
    setLoadError(null);
    setInitialLoadComplete(false);
    fetchApi(`/guilds/${guildId}/ping-protection`)
      .then((data) => {
        setConfig(normalizeConfig(data || {}));
        setLastLoadedAt(new Date());
      })
      .catch((err: any) => {
        setLoadError(toDashboardErrorState(err, "Failed to load Ping Protection settings."));
        toast(err?.message || "Failed to load Ping Protection settings", "error");
      })
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const persistConfig = useCallback(
    async (next: PingProtectionConfig) => {
      await fetchApi(`/guilds/${guildId}/ping-protection`, undefined, {
        method: "PUT",
        body: JSON.stringify({
          ...next,
          log_channel_id: next.log_channel_id || null,
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
    onError: (err: any) => toast(err?.message || "Auto-save failed for Ping Protection settings", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Ping Protection settings saved!");
    } catch (err: any) {
      toast(err?.message || "Failed to save Ping Protection settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof PingProtectionConfig, value: any) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      {/* ── Hero ── */}
      <DashboardPageHero
        icon={AtSignIcon}
        title="Ping Protection"
        subtitle="Warn members who @mention server admins or specific protected users. Configure who's protected, exemptions, and the warning message."
        stats={[
          { label: "Status", value: config.enabled ? "Active" : "Disabled" },
          { label: "Protect Admins", value: config.protect_admins ? "Yes" : "No" },
          { label: "Protected Users", value: config.protected_user_ids.length },
          { label: "Protected Roles", value: config.protected_role_ids.length },
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
            Enable Ping Protection
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.protect_admins}
              onChange={(e) => update("protect_admins", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            Protect all server administrators
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.delete_message}
              onChange={(e) => update("delete_message", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            Delete the message that pinged them
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.dm_user_on_warn}
              onChange={(e) => update("dm_user_on_warn", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            DM user with the warning
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
            placeholder="Select a channel for warning logs…"
          />
        </div>

        {/* Warn message */}
        {config.dm_user_on_warn && (
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Warning Message</label>
            <Textarea
              value={config.warn_message}
              onChange={(e) => update("warn_message", e.target.value)}
              rows={2}
              placeholder="Message DM'd to the user when they ping a protected user…"
            />
          </div>
        )}
      </Section>

      {/* ── Protected Users & Roles ── */}
      <Section title="Protected Users & Roles">
        <p className="text-xs text-discord-text-muted/70 -mt-2">
          In addition to (or instead of) administrators, protect specific users by ID or anyone holding a
          specific role — e.g. a "Staff" role.
        </p>
        <UserIdInput
          values={config.protected_user_ids}
          onChange={(v) => update("protected_user_ids", v)}
        />
        <div>
          <label className="mb-2 block text-sm font-medium text-discord-text-muted">Protected Roles</label>
          <RoleMultiSelect
            guildId={guildId}
            value={config.protected_role_ids}
            onChange={(ids) => update("protected_role_ids", ids)}
          />
        </div>
      </Section>

      {/* ── Exemptions ── */}
      <Section title="Exemptions">
        <p className="text-xs text-discord-text-muted/70 -mt-2">
          Users with any exempt role, or messages posted in any exempt channel, will never be warned for
          pinging a protected user (e.g. allow moderators to ping admins freely).
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

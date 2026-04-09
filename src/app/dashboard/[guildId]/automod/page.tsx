"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleMultiSelect, ChannelMultiSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { ShieldAlertIcon, PlusIcon, XIcon, FlaskConical, CheckCircle2, XCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutoModConfig {
  enabled: boolean;
  action: "delete" | "timeout" | "kick" | "ban";
  timeout_minutes: number;
  log_channel_id: string;
  exempt_role_ids: string[];
  exempt_channel_ids: string[];
  scan_links: boolean;
  scan_images: boolean;
  blocked_domains: string[];
  whitelist_domains: string[];
  blocked_image_hashes: string[];
  dm_user_on_action: boolean;
  dm_message: string;
}

const DEFAULT_CONFIG: AutoModConfig = {
  enabled: false,
  action: "delete",
  timeout_minutes: 10,
  log_channel_id: "",
  exempt_role_ids: [],
  exempt_channel_ids: [],
  scan_links: true,
  scan_images: false,
  blocked_domains: [],
  whitelist_domains: [],
  blocked_image_hashes: [],
  dm_user_on_action: true,
  dm_message:
    "Your message was removed because it contained prohibited content (scam/phishing).",
};

function normalizeConfig(raw: any): AutoModConfig {
  const action = ["delete", "timeout", "kick", "ban"].includes(raw?.action)
    ? (raw.action as AutoModConfig["action"])
    : "delete";
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    action,
    timeout_minutes: Math.max(1, Number(raw?.timeout_minutes || 10)),
    log_channel_id: String(raw?.log_channel_id || ""),
    exempt_role_ids: Array.isArray(raw?.exempt_role_ids) ? raw.exempt_role_ids.map(String) : [],
    exempt_channel_ids: Array.isArray(raw?.exempt_channel_ids) ? raw.exempt_channel_ids.map(String) : [],
    blocked_domains: Array.isArray(raw?.blocked_domains) ? raw.blocked_domains.map(String) : [],
    whitelist_domains: Array.isArray(raw?.whitelist_domains) ? raw.whitelist_domains.map(String) : [],
    blocked_image_hashes: Array.isArray(raw?.blocked_image_hashes) ? raw.blocked_image_hashes.map(String) : [],
    dm_message: String(raw?.dm_message || DEFAULT_CONFIG.dm_message),
  };
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    if (!v || values.includes(v)) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-discord-text-muted">{label}</label>
      {hint && <p className="mb-2 text-xs text-discord-text-muted/70">{hint}</p>}
      <div className="flex gap-2 mb-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button onClick={add} className="shrink-0 gap-1">
          <PlusIcon className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-discord-text"
            >
              {v}
              <button
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="ml-0.5 text-discord-text-muted hover:text-red-400 transition-colors"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── HashInput (same idea but no domain stripping) ─────────────────────────────

function HashInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim().toLowerCase();
    if (v.length < 8 || values.includes(v)) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-discord-text-muted">Blocked Image Hashes (SHA-256)</label>
      <p className="mb-2 text-xs text-discord-text-muted/70">
        Paste the SHA-256 fingerprint of a known scam image. The bot will delete any upload matching it exactly.
      </p>
      <div className="flex gap-2 mb-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. a3f2c1... (64-char hex)"
          className="font-mono text-xs"
        />
        <Button onClick={add} className="shrink-0 gap-1">
          <PlusIcon className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="space-y-1">
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

export default function AutoModPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [config, setConfig] = useState<AutoModConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Test config state
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<null | { triggered: boolean; reason: string; action?: string; url?: string }>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/automod`)
      .then((data) => setConfig(normalizeConfig(data || {})))
      .catch(() => toast("Failed to load Auto-Mod settings", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistConfig = useCallback(
    async (next: AutoModConfig) => {
      await fetchApi(`/guilds/${guildId}/automod`, undefined, {
        method: "PUT",
        body: JSON.stringify({
          ...next,
          log_channel_id: next.log_channel_id || null,
          timeout_minutes: Math.max(1, next.timeout_minutes),
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
    onError: () => toast("Auto-save failed for Auto-Mod settings", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Auto-Mod settings saved!");
    } catch {
      toast("Failed to save Auto-Mod settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof AutoModConfig, value: any) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleTest = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetchApi("/trigger/automod_test", undefined, {
        method: "POST",
        body: JSON.stringify({ guild_id: guildId, payload: { text: testText } }),
      });
      setTestResult(res?.result ?? null);
    } catch {
      toast("Test request failed.", "error");
    } finally {
      setTesting(false);
    }
  };

  const actionLabel: Record<string, string> = {
    delete: "🗑️ Delete Message",
    timeout: `⏱️ Timeout (${config.timeout_minutes} min)`,
    kick: "👢 Kick User",
    ban: "🔨 Ban User",
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      {/* ── Hero ── */}
      <DashboardPageHero
        icon={ShieldAlertIcon}
        title="Auto Moderation"
        subtitle="Automatically detect and act on scam links and prohibited images. Configure actions, exemptions, and domain lists."
        stats={[
          { label: "Status", value: config.enabled ? "Active" : "Disabled" },
          { label: "Action", value: config.action.charAt(0).toUpperCase() + config.action.slice(1) },
          { label: "Blocked Domains", value: config.blocked_domains.length },
          { label: "Whitelist", value: config.whitelist_domains.length },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        }
      />

      {/* ── General Settings ── */}
      <Section title="General Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              id="automod-enabled"
              checked={config.enabled}
              onChange={(e) => update("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            Enable Auto Moderation
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              id="automod-dm"
              checked={config.dm_user_on_action}
              onChange={(e) => update("dm_user_on_action", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
            />
            DM user when their message is removed
          </label>
        </div>

        {/* Action selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Action</label>
            <select
              id="automod-action"
              value={config.action}
              onChange={(e) => update("action", e.target.value as AutoModConfig["action"])}
              className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
            >
              <option value="delete">🗑️ Delete message only</option>
              <option value="timeout">⏱️ Delete + Timeout user</option>
              <option value="kick">👢 Delete + Kick user</option>
              <option value="ban">🔨 Delete + Ban user</option>
            </select>
          </div>

          {config.action === "timeout" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-discord-text-muted">
                Timeout Duration (minutes)
              </label>
              <Input
                id="automod-timeout-minutes"
                type="number"
                min={1}
                max={40320}
                value={config.timeout_minutes}
                onChange={(e) => update("timeout_minutes", Math.max(1, Number(e.target.value || 10)))}
              />
            </div>
          )}
        </div>

        {/* DM message */}
        {config.dm_user_on_action && (
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">DM Message</label>
            <Textarea
              id="automod-dm-message"
              value={config.dm_message}
              onChange={(e) => update("dm_message", e.target.value)}
              rows={2}
              placeholder="Message sent to the user when their message is removed…"
            />
          </div>
        )}

        {/* Log channel */}
        <div>
          <label className="mb-2 block text-sm font-medium text-discord-text-muted">
            Log Channel <span className="text-discord-text-muted/60 font-normal">(optional)</span>
          </label>
          <ChannelSelect
            guildId={guildId}
            value={config.log_channel_id}
            onChange={(id) => update("log_channel_id", id)}
            placeholder="Select a channel for action logs…"
          />
        </div>
      </Section>

      {/* ── Scope / Exemptions ── */}
      <Section title="Exemptions">
        <p className="text-xs text-discord-text-muted/70 -mt-2">
          Messages from users with any exempt role, or posted in any exempt channel, will never be scanned.
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

      {/* ── Link Scanning ── */}
      <Section title="Link Scanning">
        <label className="flex items-center gap-2 text-sm text-discord-text-muted">
          <input
            type="checkbox"
            id="automod-scan-links"
            checked={config.scan_links}
            onChange={(e) => update("scan_links", e.target.checked)}
            className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
          />
          Enable link scanning
        </label>

        {config.scan_links && (
          <div className="rounded-lg border border-discord-blurple/20 bg-discord-blurple/5 px-4 py-3 text-xs text-discord-text-muted space-y-1">
            <p className="font-semibold text-discord-text">Always-blocked patterns (built-in):</p>
            <p>• Discord Nitro gift scams <span className="opacity-60">(discord.gift, discordapp.gift, dlscord.*, discrord.*…)</span></p>
            <p>• "Free Nitro" / "Nitro Giveaway" text in any URL</p>
            <p>• Steam Community free-offer phishing pages</p>
          </div>
        )}

        {config.scan_links && (
          <div className="space-y-5">
            <TagInput
              label="Blocked Domains"
              hint="Additional domains to always block. Enter just the domain (e.g. evil-site.com)."
              values={config.blocked_domains}
              onChange={(v) => update("blocked_domains", v)}
              placeholder="evil-site.com"
            />
            <TagInput
              label="Whitelisted Domains"
              hint="Domains that are always safe and will never be flagged, even if they match a blocked pattern."
              values={config.whitelist_domains}
              onChange={(v) => update("whitelist_domains", v)}
              placeholder="yoursite.com"
            />
          </div>
        )}
      </Section>

      {/* ── Image Scanning ── */}
      <Section title="Image Scanning">
        <label className="flex items-center gap-2 text-sm text-discord-text-muted">
          <input
            type="checkbox"
            id="automod-scan-images"
            checked={config.scan_images}
            onChange={(e) => update("scan_images", e.target.checked)}
            className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
          />
          Enable image scanning (hash blocklist)
        </label>

        <p className="text-xs text-discord-text-muted/70">
          When enabled, the bot computes the SHA-256 fingerprint of every uploaded image and compares it
          against your blocked-hash list. Matching images are auto-removed.
        </p>

        {config.scan_images && (
          <HashInput
            values={config.blocked_image_hashes}
            onChange={(v) => update("blocked_image_hashes", v)}
          />
        )}
      </Section>

      {/* ── Test Config ── */}
      <Section title="Test Configuration">
        <p className="text-xs text-discord-text-muted/70 -mt-2">
          Paste a message containing a suspicious link to see exactly what the bot would do — no real action is taken.
        </p>

        <div className="flex gap-2">
          <Input
            id="automod-test-input"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleTest(); }}
            placeholder="e.g. hey claim your free nitro at discord.gift/abc123"
          />
          <Button onClick={handleTest} disabled={testing || !testText.trim()} className="shrink-0">
            <FlaskConical className="h-4 w-4 mr-1.5" />
            {testing ? "Testing…" : "Test"}
          </Button>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
              testResult.triggered
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-green-500/30 bg-green-500/10 text-green-300"
            }`}
          >
            {testResult.triggered ? (
              <XCircle className="h-5 w-5 mt-0.5 shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-green-400" />
            )}
            <div className="space-y-0.5">
              <p className="font-semibold">{testResult.triggered ? "Would trigger!" : "No threat detected"}</p>
              <p className="opacity-80">{testResult.reason}</p>
              {testResult.triggered && testResult.action && (
                <p className="opacity-70">
                  Action: <span className="font-medium">{actionLabel[testResult.action] ?? testResult.action}</span>
                </p>
              )}
              {testResult.url && (
                <p className="font-mono text-xs opacity-60 break-all">Flagged URL: {testResult.url}</p>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

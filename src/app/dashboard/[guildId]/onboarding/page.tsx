"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api";
import { toDashboardErrorState, type DashboardErrorState } from "@/lib/dashboard-errors";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, ChannelMultiSelect, RoleMultiSelect, RoleSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { DashboardErrorBanner } from "@/components/ui/dashboard-error-banner";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import {
  WelcomeConfigBuilder,
  type LegacyWelcomeMessage,
  type WelcomeDynamicImage,
  type WelcomeMessageGroup,
  type WelcomeMessageTemplate,
  normalizeWelcomeDynamicImages,
  normalizeWelcomeGroups,
  normalizeWelcomeMessages,
} from "@/components/ui/welcome-config-builder";
import { UserCheckIcon } from "lucide-react";

interface OnboardingConfig {
  enabled: boolean;
  verification_enabled: boolean;
  verification_channel_id: string;
  verified_role_id: string;
  auto_role_ids: string[];
  lock_until_verified: boolean;
  dm_on_join: boolean;

  panel_message_id: string;
  panel_button_label: string;
  panel_content: string;
  panel_embed_title: string;
  panel_embed_description: string;
  panel_embed_color: string;
  panel_embed_thumbnail: string;
  panel_embed_image: string;
  panel_embed_footer: string;

  welcome_enabled: boolean;
  welcome_channel_id: string;
  welcome_content: string;
  welcome_embed_title: string;
  welcome_embed_description: string;
  welcome_embed_color: string;
  welcome_embed_thumbnail: string;
  welcome_embed_image: string;
  welcome_embed_footer: string;
  welcome_message_groups: WelcomeMessageGroup[];
  welcome_messages: WelcomeMessageTemplate[];
  welcome_dynamic_images: WelcomeDynamicImage[];
  send_welcome_on_join: boolean;
  send_welcome_on_verify: boolean;

  join_guard_enabled: boolean;
  min_account_age_days: number;
  block_default_avatar: boolean;
  join_guard_action: "kick" | "ban";
  join_guard_log_channel_id: string;

  visible_before_verify_channel_ids: string[];
}

const DEFAULT_CONFIG: OnboardingConfig = {
  enabled: false,
  verification_enabled: false,
  verification_channel_id: "",
  verified_role_id: "",
  auto_role_ids: [],
  lock_until_verified: true,
  dm_on_join: true,

  panel_message_id: "",
  panel_button_label: "Verify Me",
  panel_content: "",
  panel_embed_title: "Verification Required",
  panel_embed_description: "Click the button below to verify and unlock full server access.",
  panel_embed_color: "#A3A7B0",
  panel_embed_thumbnail: "",
  panel_embed_image: "",
  panel_embed_footer: "Verification System",

  welcome_enabled: true,
  welcome_channel_id: "",
  welcome_content: "",
  welcome_embed_title: "Welcome ${userglobalnickname}!",
  welcome_embed_description: "to ${guildname}\n\nYou are member #${guildmembercount}.",
  welcome_embed_color: "#A3A7B0",
  welcome_embed_thumbnail: "",
  welcome_embed_image: "",
  welcome_embed_footer: "Enjoy your stay",
  welcome_message_groups: [
    {
      id: "group-main",
      name: "Group 1",
      channel_id: "",
      enabled: true,
    },
  ],
  welcome_messages: [
    {
      id: "message-main",
      name: "Message 1",
      group_id: "group-main",
      weight: 1,
      enabled: true,
      message_mode: "normal",
      content: "",
      embed_title: "Welcome ${userglobalnickname}!",
      embed_description: "to ${guildname}\n\nYou are member #${guildmembercount}.",
      embed_color: "#A3A7B0",
      embed_thumbnail: "",
      embed_image: "",
      embed_footer: "Enjoy your stay",
      dynamic_image_id: "",
    },
  ],
  welcome_dynamic_images: [],
  send_welcome_on_join: false,
  send_welcome_on_verify: true,

  join_guard_enabled: false,
  min_account_age_days: 0,
  block_default_avatar: false,
  join_guard_action: "kick",
  join_guard_log_channel_id: "",

  visible_before_verify_channel_ids: [],
};

function normalizeConfig(raw: any): OnboardingConfig {
  const normalizedWelcomeChannel = String(raw?.welcome_channel_id || "");
  const legacyWelcome: LegacyWelcomeMessage = {
    content: String(raw?.welcome_content || ""),
    embed_title: String(raw?.welcome_embed_title || DEFAULT_CONFIG.welcome_embed_title),
    embed_description: String(raw?.welcome_embed_description || DEFAULT_CONFIG.welcome_embed_description),
    embed_color: String(raw?.welcome_embed_color || DEFAULT_CONFIG.welcome_embed_color),
    embed_thumbnail: String(raw?.welcome_embed_thumbnail || ""),
    embed_image: String(raw?.welcome_embed_image || ""),
    embed_footer: String(raw?.welcome_embed_footer || DEFAULT_CONFIG.welcome_embed_footer),
  };

  const normalizedWelcomeGroups = normalizeWelcomeGroups(raw?.welcome_message_groups, normalizedWelcomeChannel);
  const normalizedWelcomeMessages = normalizeWelcomeMessages(raw?.welcome_messages, normalizedWelcomeGroups, legacyWelcome);
  const normalizedDynamicImages = normalizeWelcomeDynamicImages(raw?.welcome_dynamic_images);

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    verification_channel_id: String(raw?.verification_channel_id || ""),
    verified_role_id: String(raw?.verified_role_id || ""),
    auto_role_ids: Array.isArray(raw?.auto_role_ids) ? raw.auto_role_ids.map(String) : [],

    panel_message_id: String(raw?.panel_message_id || ""),
    panel_button_label: String(raw?.panel_button_label || DEFAULT_CONFIG.panel_button_label),
    panel_content: String(raw?.panel_content || ""),
    panel_embed_title: String(raw?.panel_embed_title || DEFAULT_CONFIG.panel_embed_title),
    panel_embed_description: String(raw?.panel_embed_description || DEFAULT_CONFIG.panel_embed_description),
    panel_embed_color: String(raw?.panel_embed_color || DEFAULT_CONFIG.panel_embed_color),
    panel_embed_thumbnail: String(raw?.panel_embed_thumbnail || ""),
    panel_embed_image: String(raw?.panel_embed_image || ""),
    panel_embed_footer: String(raw?.panel_embed_footer || DEFAULT_CONFIG.panel_embed_footer),

    welcome_channel_id: normalizedWelcomeChannel,
    welcome_content: legacyWelcome.content,
    welcome_embed_title: legacyWelcome.embed_title,
    welcome_embed_description: legacyWelcome.embed_description,
    welcome_embed_color: legacyWelcome.embed_color,
    welcome_embed_thumbnail: legacyWelcome.embed_thumbnail,
    welcome_embed_image: legacyWelcome.embed_image,
    welcome_embed_footer: legacyWelcome.embed_footer,
    welcome_message_groups: normalizedWelcomeGroups,
    welcome_messages: normalizedWelcomeMessages,
    welcome_dynamic_images: normalizedDynamicImages,

    min_account_age_days: Math.max(0, Number(raw?.min_account_age_days || 0)),
    join_guard_action: raw?.join_guard_action === "ban" ? "ban" : "kick",
    join_guard_log_channel_id: String(raw?.join_guard_log_channel_id || ""),
    visible_before_verify_channel_ids: Array.isArray(raw?.visible_before_verify_channel_ids)
      ? raw.visible_before_verify_channel_ids.map(String)
      : [],
  };
}

export default function OnboardingPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [config, setConfig] = useState<OnboardingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [postingPanel, setPostingPanel] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState<DashboardErrorState | null>(null);
  const [lastPersistedConfig, setLastPersistedConfig] = useState<OnboardingConfig>(DEFAULT_CONFIG);
  const [saveSummary, setSaveSummary] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const validateBeforeSave = useCallback((nextConfig: OnboardingConfig): string | null => {
    const urlFields = [
      nextConfig.panel_embed_thumbnail,
      nextConfig.panel_embed_image,
      nextConfig.welcome_embed_thumbnail,
      nextConfig.welcome_embed_image,
    ];
    const badUrl = urlFields.find((value) => {
      const text = String(value || "").trim();
      return text.length > 0 && !/^https?:\/\//i.test(text);
    });
    if (badUrl) {
      return "Embed image/thumbnail URLs must start with http:// or https://";
    }

    const colorFields = [nextConfig.panel_embed_color, nextConfig.welcome_embed_color];
    const badColor = colorFields.find((value) => {
      const text = String(value || "").trim();
      if (!text) return true;
      if (/^\d+$/.test(text)) return false;
      return !/^#[0-9a-fA-F]{6}$/.test(text);
    });
    if (badColor) {
      return "Embed colors must be #RRGGBB or a decimal color value.";
    }

    return null;
  }, []);

  const loadConfig = useCallback(() => {
    setLoadError(null);
    setInitialLoadComplete(false);
    fetchApi(`/guilds/${guildId}/onboarding`)
      .then((data) => {
        const normalized = normalizeConfig(data || {});
        setConfig(normalized);
        setLastPersistedConfig(normalized);
        setLastLoadedAt(new Date());
        setSaveSummary(null);
      })
      .catch((err) => {
        setLoadError(toDashboardErrorState(err, "Failed to load onboarding settings."));
        toast("Failed to load onboarding settings", "error");
      })
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const persistConfig = useCallback(async (nextConfig: OnboardingConfig) => {
    const sanitizedWelcomeGroups = (nextConfig.welcome_message_groups || []).map((group) => ({
      id: String(group.id || ""),
      name: String(group.name || "Group"),
      channel_id: String(group.channel_id || ""),
      enabled: Boolean(group.enabled),
    }));

    const sanitizedWelcomeMessages = (nextConfig.welcome_messages || []).map((message) => ({
      id: String(message.id || ""),
      name: String(message.name || "Message"),
      group_id: String(message.group_id || sanitizedWelcomeGroups[0]?.id || "group-main"),
      weight: Math.max(1, Number(message.weight || 1)),
      enabled: Boolean(message.enabled),
      message_mode: message.message_mode === "normal" ? "normal" : "embed",
      content: String(message.content || ""),
      embed_title: String(message.embed_title || ""),
      embed_description: String(message.embed_description || ""),
      embed_color: String(message.embed_color || "#A3A7B0"),
      embed_thumbnail: String(message.embed_thumbnail || ""),
      embed_image: String(message.embed_image || ""),
      embed_footer: String(message.embed_footer || ""),
      dynamic_image_id: String(message.dynamic_image_id || ""),
    }));

    const sanitizedDynamicImages = (nextConfig.welcome_dynamic_images || []).map((image) => ({
      id: String(image.id || ""),
      name: String(image.name || "Dynamic Image"),
      width: Math.max(128, Number(image.width || 500)),
      height: Math.max(128, Number(image.height || 350)),
      background_color: String(image.background_color || "#121317"),
      layers: (image.layers || []).map((layer) => ({
        id: String(layer.id || ""),
        name: String(layer.name || "Layer"),
        type: layer.type === "avatar" || layer.type === "block" || layer.type === "logo" ? layer.type : "text",
        enabled: Boolean(layer.enabled),
        z_position: layer.z_position === "back" ? "back" : "front",
        text: String(layer.text || ""),
        image_url: String(layer.image_url || ""),
        color: String(layer.color || "#FFFFFF"),
        font_weight: layer.font_weight === "bold" ? "bold" : "normal",
        text_align:
          layer.text_align === "center" || layer.text_align === "right"
            ? layer.text_align
            : "left",
        text_vertical_align:
          layer.text_vertical_align === "middle" || layer.text_vertical_align === "bottom"
            ? layer.text_vertical_align
            : "top",
        x: Number(layer.x || 0),
        y: Number(layer.y || 0),
        width: Math.max(1, Number(layer.width || 120)),
        height: Math.max(1, Number(layer.height || 60)),
        font_size: Math.max(8, Number(layer.font_size || 20)),
        opacity: Math.min(100, Math.max(0, Number(layer.opacity ?? 100))),
        radius: Math.max(0, Number(layer.radius || 0)),
      })),
    }));

    const firstMessage = sanitizedWelcomeMessages[0] || null;

    await fetchApi(`/guilds/${guildId}/onboarding`, undefined, {
      method: "PUT",
      body: JSON.stringify({
        ...nextConfig,
        auto_role_ids: (nextConfig.auto_role_ids || []).map(String),
        verification_channel_id: nextConfig.verification_channel_id || null,
        verified_role_id: nextConfig.verified_role_id || null,
        panel_message_id: nextConfig.panel_message_id || null,
        panel_embed_thumbnail: nextConfig.panel_embed_thumbnail || null,
        panel_embed_image: nextConfig.panel_embed_image || null,
        welcome_channel_id: nextConfig.welcome_channel_id || null,
        welcome_content: firstMessage?.content || nextConfig.welcome_content || "",
        welcome_embed_title: firstMessage?.embed_title || nextConfig.welcome_embed_title || "",
        welcome_embed_description: firstMessage?.embed_description || nextConfig.welcome_embed_description || "",
        welcome_embed_color: firstMessage?.embed_color || nextConfig.welcome_embed_color || "#A3A7B0",
        welcome_embed_thumbnail: (firstMessage?.embed_thumbnail || nextConfig.welcome_embed_thumbnail || "") || null,
        welcome_embed_image: (firstMessage?.embed_image || nextConfig.welcome_embed_image || "") || null,
        welcome_embed_footer: firstMessage?.embed_footer || nextConfig.welcome_embed_footer || "",
        welcome_message_groups: sanitizedWelcomeGroups,
        welcome_messages: sanitizedWelcomeMessages,
        welcome_dynamic_images: sanitizedDynamicImages,
        join_guard_log_channel_id: nextConfig.join_guard_log_channel_id || null,
        visible_before_verify_channel_ids: (nextConfig.visible_before_verify_channel_ids || []).map(String),
      }),
    });
    setLastSaved(new Date());
    setLastPersistedConfig(nextConfig);
    setSaveSummary({ type: "success", text: "Settings saved successfully." });
  }, [guildId]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(lastPersistedConfig),
    [config, lastPersistedConfig]
  );

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: () => {
      setSaveSummary({ type: "error", text: "Auto-save failed. Please retry." });
      toast("Auto-save failed for onboarding settings", "error");
    },
  });

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    const validationError = validateBeforeSave(config);
    if (validationError) {
      setSaveSummary({ type: "error", text: validationError });
      toast(validationError, "error");
      return;
    }
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Onboarding settings saved!");
    } catch {
      setSaveSummary({ type: "error", text: "Failed to save onboarding settings." });
      toast("Failed to save onboarding settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePostVerificationPanel = async () => {
    if (!config.verification_channel_id) {
      setSaveSummary({ type: "error", text: "Verification channel is required before posting panel." });
      toast("Select a verification channel first.", "error");
      return;
    }
    const validationError = validateBeforeSave(config);
    if (validationError) {
      setSaveSummary({ type: "error", text: validationError });
      toast(validationError, "error");
      return;
    }

    setPostingPanel(true);
    try {
      await persistConfig(config);

      await fetchApi("/trigger/verification_panel", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_id: config.verification_channel_id,
            panel_message_id: config.panel_message_id || null,
            panel_button_label: config.panel_button_label || "Verify Me",
            panel_content: config.panel_content || "",
            panel_embed_title: config.panel_embed_title || "Verification Required",
            panel_embed_description:
              config.panel_embed_description || "Click the button below to verify and unlock full server access.",
            panel_embed_color: config.panel_embed_color || "#A3A7B0",
            panel_embed_thumbnail: config.panel_embed_thumbnail || null,
            panel_embed_image: config.panel_embed_image || null,
            panel_embed_footer: config.panel_embed_footer || null,
          },
        }),
      });

      toast("Verification panel trigger sent! It should appear in your configured verification channel.");

      const latest = await fetchApi(`/guilds/${guildId}/onboarding`);
      const normalized = normalizeConfig(latest || {});
      setConfig(normalized);
      setLastPersistedConfig(normalized);
      setLastLoadedAt(new Date());
      setSaveSummary({ type: "success", text: "Panel posted and settings refreshed." });
    } catch (err: any) {
      setSaveSummary({ type: "error", text: `Failed to post verification panel: ${err.message}` });
      toast(`Failed to post verification panel: ${err.message}`, "error");
    } finally {
      setPostingPanel(false);
    }
  };

  const updateConfig = (key: keyof OnboardingConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={UserCheckIcon}
        title="Onboarding, Verification, and Join Guard"
        subtitle="Control how new members enter your server: welcome messaging, gated verification, role assignment, and anti-alt checks."
        stats={[
          { label: "System", value: config.enabled ? "Enabled" : "Disabled" },
          { label: "Verification", value: config.verification_enabled ? "Enabled" : "Disabled" },
          { label: "Auto Roles", value: config.auto_role_ids.length },
          { label: "Join Guard", value: config.join_guard_enabled ? "Armed" : "Off" },
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
            {saveSummary && (
              <span className={`text-xs ${saveSummary.type === "error" ? "text-red-300" : "text-green-300"}`}>
                {saveSummary.text}
              </span>
            )}
            {hasUnsavedChanges && (
              <Button
                variant="outline"
                onClick={() => {
                  setConfig(lastPersistedConfig);
                  setSaveSummary({ type: "success", text: "Reverted to last saved settings." });
                }}
              >
                Reset to Last Saved
              </Button>
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

      <div className="rounded-xl border border-[#1E1F22] bg-[#1f2024] p-6">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateConfig("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-white"
            />
            Enable Onboarding System
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.verification_enabled}
              onChange={(e) => updateConfig("verification_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-white"
            />
            Enable Verification Gate
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Verification Channel</label>
            <ChannelSelect
              guildId={guildId}
              value={config.verification_channel_id}
              onChange={(id) => updateConfig("verification_channel_id", id)}
              placeholder="Select verification channel..."
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Verified Role</label>
            <RoleSelect
              guildId={guildId}
              value={config.verified_role_id}
              onChange={(id) => updateConfig("verified_role_id", id)}
              placeholder="Role granted after verify"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-discord-text-muted">Auto Roles (granted after verify, or on join if verification is disabled)</label>
          <RoleMultiSelect
            guildId={guildId}
            value={config.auto_role_ids}
            onChange={(ids) => updateConfig("auto_role_ids", ids)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.lock_until_verified}
              onChange={(e) => updateConfig("lock_until_verified", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-white"
            />
            Lock channel visibility until verified
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.dm_on_join}
              onChange={(e) => updateConfig("dm_on_join", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-white"
            />
            DM users on join with verification instructions
          </label>
        </div>

        {config.lock_until_verified && (
          <div className="mt-4 rounded-xl border border-[#1E1F22] bg-[#202225]/60 p-4">
            <label className="mb-1 block text-sm font-medium text-discord-text-muted">
              🔓 Channels Visible Before Verification
            </label>
            <p className="mb-3 text-xs text-discord-text-muted">
              These channels will remain visible to unverified members alongside the verification and welcome channels.
              Useful for <strong>#rules</strong>, <strong>#announcements</strong>, etc.
            </p>
            <ChannelMultiSelect
              guildId={guildId}
              value={config.visible_before_verify_channel_ids}
              onChange={(ids) => updateConfig("visible_before_verify_channel_ids", ids)}
            />
          </div>
        )}

        <div className="mt-6 rounded-xl border border-[#1E1F22] bg-[#202225]/80 p-4 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-discord-text-muted">Verification Panel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-discord-text-muted">Button Label</label>
              <Input
                value={config.panel_button_label}
                onChange={(e) => updateConfig("panel_button_label", e.target.value)}
                placeholder="Verify Me"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-discord-text-muted">Panel Message ID</label>
              <Input
                value={config.panel_message_id}
                onChange={(e) => updateConfig("panel_message_id", e.target.value)}
                placeholder="Auto-filled after posting"
              />
            </div>
          </div>

          <AdvancedEmbedEditor
            config={{
              content: config.panel_content,
              title: config.panel_embed_title,
              description: config.panel_embed_description,
              color: config.panel_embed_color,
              thumbnail_url: config.panel_embed_thumbnail,
              footer: config.panel_embed_footer,
            }}
            onChange={(key, value) => {
              if (key === "content") updateConfig("panel_content", value);
              else if (key === "title") updateConfig("panel_embed_title", value);
              else if (key === "description") updateConfig("panel_embed_description", value);
              else if (key === "color") updateConfig("panel_embed_color", value);
              else if (key === "thumbnail_url") updateConfig("panel_embed_thumbnail", value);
              else if (key === "footer") updateConfig("panel_embed_footer", value);
            }}
            bottomChildren={
              <div className="border-t border-[#1E1F22] pt-4">
                <label className="mb-2 block text-sm font-medium text-discord-text-muted">Panel Embed Image URL (optional)</label>
                <Input
                  value={config.panel_embed_image}
                  onChange={(e) => updateConfig("panel_embed_image", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            }
          >
            <div className="text-sm text-discord-text-muted">
              Design your verification message here. Use the Raw tab to import JSON templates from Sapphire/Discohook.
            </div>
          </AdvancedEmbedEditor>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handlePostVerificationPanel} disabled={postingPanel || !config.verification_channel_id}>
              {postingPanel ? "Posting..." : "Post / Refresh Verification Panel"}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const meRes = await fetch("/api/auth/me");
                  if (!meRes.ok) {
                    toast("Failed to determine your user ID to trigger test verification.", "error");
                    return;
                  }
                  const me = await meRes.json();
                  const triggerRes = await fetchApi(`/bot/trigger/verify_member_web`, undefined, {
                    method: "POST",
                    body: JSON.stringify({
                      guild_id: guildId,
                      payload: { user_id: me.id, test_mode: true },
                    }),
                  });
                  toast(triggerRes.message || "Test verification completed successfully! Check Discord.", "success");
                } catch (e: any) {
                  toast(`Test failed: ${e.message}`, "error");
                }
              }}
            >
              Simulate Verification (Direct)
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const meRes = await fetch("/api/auth/me");
                  if (!meRes.ok) {
                    toast("Failed to load user ID", "error");
                    return;
                  }
                  const me = await meRes.json();
                  const res = await fetchApi(`/bot/trigger/generate_verification_link`, undefined, {
                    method: "POST",
                    body: JSON.stringify({
                      guild_id: guildId,
                      payload: { user_id: me.id, test_mode: true },
                    }),
                  });
                  if (res.url) {
                    window.open(res.url, "_blank");
                  } else {
                    throw new Error(res.message || "Failed to generate link");
                  }
                } catch(e: any) {
                  toast(`Link generation failed: ${e.message}`, "error");
                }
              }}
            >
              Test Website Verification Flow
            </Button>
          </div>
        </div>
      </div>

      <WelcomeConfigBuilder
        guildId={guildId}
        welcomeEnabled={config.welcome_enabled}
        welcomeChannelId={config.welcome_channel_id}
        sendWelcomeOnJoin={config.send_welcome_on_join}
        sendWelcomeOnVerify={config.send_welcome_on_verify}
        groups={config.welcome_message_groups}
        messages={config.welcome_messages}
        dynamicImages={config.welcome_dynamic_images}
        onWelcomeEnabledChange={(value) => updateConfig("welcome_enabled", value)}
        onWelcomeChannelChange={(value) => updateConfig("welcome_channel_id", value)}
        onSendOnJoinChange={(value) => updateConfig("send_welcome_on_join", value)}
        onSendOnVerifyChange={(value) => updateConfig("send_welcome_on_verify", value)}
        onGroupsChange={(value) => updateConfig("welcome_message_groups", value)}
        onMessagesChange={(value) => updateConfig("welcome_messages", value)}
        onDynamicImagesChange={(value) => updateConfig("welcome_dynamic_images", value)}
      />

      <div className="rounded-xl border border-[#1E1F22] bg-[#1f2024] p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Join Guard (Anti-Alt Basics)</h2>
        <p className="text-sm text-discord-text-muted">
          This can block very new accounts and users with default avatars. VPN/IP checks are not available through Discord bot APIs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.join_guard_enabled}
              onChange={(e) => updateConfig("join_guard_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-white"
            />
            Enable Join Guard
          </label>

          <label className="flex items-center gap-2 text-sm text-discord-text-muted">
            <input
              type="checkbox"
              checked={config.block_default_avatar}
              onChange={(e) => updateConfig("block_default_avatar", e.target.checked)}
              className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-white"
            />
            Block accounts without a custom avatar
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Minimum Account Age (days)</label>
            <Input
              type="number"
              min={0}
              value={config.min_account_age_days}
              onChange={(e) => updateConfig("min_account_age_days", Math.max(0, Number(e.target.value || 0)))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Action</label>
            <select
              value={config.join_guard_action}
              onChange={(e) => updateConfig("join_guard_action", e.target.value as "kick" | "ban")}
              className="flex h-10 w-full rounded-xl border border-white/14 bg-[rgba(24,24,27,0.92)] px-3 py-2 text-sm text-discord-text"
            >
              <option value="kick">Kick</option>
              <option value="ban">Ban</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Join Guard Log Channel (optional)</label>
            <ChannelSelect
              guildId={guildId}
              value={config.join_guard_log_channel_id}
              onChange={(id) => updateConfig("join_guard_log_channel_id", id)}
              placeholder="Select log channel..."
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#1E1F22]">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const meRes = await fetch("/api/auth/me");
                if (!meRes.ok) throw new Error("Failed to load your user ID");
                const me = await meRes.json();
                
                const triggerRes = await fetchApi(`/bot/trigger/test_join_guard`, undefined, {
                  method: "POST",
                  body: JSON.stringify({
                    guild_id: guildId,
                    payload: { user_id: me.id },
                  }),
                });
                toast(triggerRes.message || "Test DM and Log sent!", "success");
              } catch (e: any) {
                toast(`Test failed: ${e.message}`, "error");
              }
            }}
          >
            Test Join Guard DM & Log Format
          </Button>
          <p className="mt-2 text-xs text-discord-text-muted">
            Simulates a blocker event so you can view the PM an offender would receive, and the embed to the log channel. You will not actually be kicked or banned.
          </p>
        </div>
      </div>
    </div>
  );
}

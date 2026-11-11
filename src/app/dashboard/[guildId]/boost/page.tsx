"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { DiscordMessagePreview } from "@/components/ui/discord-message";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { GemIcon } from "lucide-react";

export default function BoostRewardsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [config, setConfig] = useState<any>({ roles: [], days_per_boost: 15 });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInitialLoadComplete(false);
    setLastSaved(null);
    fetchApi(`/guilds/${guildId}/boost`)
      .then((data) => {
        if (cancelled) return;
        setConfig({ roles: [], days_per_boost: 15, ...data });
        setInitialLoadComplete(true);
      })
      .catch(() => { if (!cancelled) toast("Failed to load boost config", "error"); });
    return () => { cancelled = true; };
  }, [guildId, toast]);

  const daysPerBoost = config.days_per_boost;
  const durationValid = Number.isInteger(daysPerBoost) && daysPerBoost >= 1 && daysPerBoost <= 365;

  const persistConfig = useCallback(async (nextConfig: any) => {
    if (!Number.isInteger(nextConfig.days_per_boost) || nextConfig.days_per_boost < 1 || nextConfig.days_per_boost > 365) {
      throw new Error("Days per boost must be a whole number from 1 to 365.");
    }
    await fetchApi(`/guilds/${guildId}/boost`, undefined, {
      method: "PUT",
      body: JSON.stringify({
        ...nextConfig,
        roles: (nextConfig.roles || []).map(String),
        channel_id: nextConfig.channel_id || null,
        category_id: nextConfig.category_id || null,
      }),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete && durationValid,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: (err: any) => toast(err?.message || "Auto-save failed for boost config", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Boost Config Saved!");
    } catch (e: any) {
        toast(e?.message || "Failed to save.", "error");
      } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, val: any) => {
    setConfig({ ...config, [key]: val });
  };
  const configuredRoles = (config.roles || []).length;
  const hasLogChannel = Boolean(config.channel_id);
  const hasCategory = Boolean(config.category_id);

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={GemIcon}
        title="Server Boost Rewards"
        subtitle="Configure reward days per boost, claim routing, and booster notifications."
        stats={[
          { label: "Log Channel", value: hasLogChannel ? "Configured" : "Missing" },
          { label: "Claim Category", value: hasCategory ? "Configured" : "Missing" },
          { label: "Ping Roles", value: configuredRoles },
          { label: "Status", value: hasLogChannel && hasCategory ? "Ready" : "Needs Setup" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving || !initialLoadComplete || !durationValid}>
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </div>
        }
      />


      <div className="flex xl:flex-row flex-col gap-6">
        <div className="flex-1 flex flex-col gap-6 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
          <div>
            <label htmlFor="boost-reward-days" className="mb-2 block text-sm font-medium text-discord-text-muted">Days per boost</label>
            <Input
              id="boost-reward-days"
              type="number"
              min={1}
              max={365}
              step={1}
              value={daysPerBoost}
              disabled={!initialLoadComplete}
              aria-invalid={!durationValid}
              aria-describedby="boost-duration-help"
              onChange={(event) => updateConfig("days_per_boost", event.target.value === "" ? "" : Number(event.target.value))}
            />
            <p id="boost-duration-help" className="mt-2 text-xs text-discord-text-muted">
              {durationValid ? `1 boost = ${daysPerBoost} days; 2 boosts = ${daysPerBoost * 2} days total.` : "Enter a whole number from 1 to 365."}
              {" "}Applies to new boost credits only. Existing rewards and pending credits keep their saved duration.
              {" "}The bot needs its provider API key to set the first key duration and extend it; your generation webhook can stay at 15 days.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Boost Log Channel</label>
            <ChannelSelect
              guildId={guildId}
              value={config.channel_id?.toString() || ""}
              onChange={(id) => updateConfig("channel_id", id)}
              placeholder="Select log channel..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Boost Claim Ticket Category</label>
            <ChannelSelect
              guildId={guildId}
              value={config.category_id?.toString() || ""}
              onChange={(id) => updateConfig("category_id", id)}
              types={[4]}
              includeCategories
              placeholder="Select category for boost claim tickets..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Notification Roles</label>
            <RoleMultiSelect
              guildId={guildId}
              value={(config.roles || []).map(String)}
              onChange={(ids) => updateConfig("roles", ids)}
            />
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="xl:w-96 w-full shrink-0 flex flex-col gap-2">
          <h4 className="text-xs font-bold text-discord-text-muted uppercase tracking-wider pl-1">Embed Preview</h4>
          <div className="flex-1 bg-[#313338] rounded-xl border border-[#1E1F22] p-4 shadow-inner flex flex-col justify-center">
            <DiscordMessagePreview
              botName="Seisen Bot"
              timestamp="Today at 10:24 AM"
              content={(config.roles || []).map((id:string) => `<@&${id}>`).join(" ")}
              title="🌟 New Server Booster! 🌟"
              description={`Thank you **Seisen88** for boosting the server!\n${durationValid ? `${daysPerBoost} premium days per boost.` : "Set reward days to preview the reward."}\nPlease open a ticket to claim your boost rewards!`}
              color="#f47fff"
              thumbnailUrl="https://cdn.discordapp.com/emojis/862241680658792468.png"
              footerText="Server Boost #14"
              buttons={[{ label: "Claim Rewards" }]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

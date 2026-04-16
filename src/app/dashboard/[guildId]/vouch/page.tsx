"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { DiscordMessagePreview } from "@/components/ui/discord-message";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { BadgeCheckIcon } from "lucide-react";

export default function VouchSystemPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [config, setConfig] = useState<any>({ channel_id: null });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/vouch`)
      .then((data) => setConfig(data || { channel_id: null }))
      .catch(() => toast("Failed to load vouch config", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistConfig = useCallback(async (nextConfig: any) => {
    await fetchApi(`/guilds/${guildId}/vouch`, undefined, {
      method: "PUT",
      body: JSON.stringify({ channel_id: nextConfig.channel_id || null }),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: (err: any) => toast(err?.message || "Auto-save failed for vouch settings", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Vouch Config Saved!");
    } catch (e: any) {
        toast(e?.message || "Failed to save.", "error");
      } finally {
      setSaving(false);
    }
  };

  const hasChannel = Boolean(config.channel_id);

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={BadgeCheckIcon}
        title="Vouch System"
        subtitle="Set where user testimonials are collected so successful transactions are visible and trusted."
        stats={[
          { label: "Vouch Channel", value: hasChannel ? "Configured" : "Missing" },
          { label: "Post Format", value: "Embed" },
          { label: "Moderation", value: "Manual" },
          { label: "Status", value: hasChannel ? "Ready" : "Needs Setup" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </div>
        }
      />

      <div className="flex xl:flex-row flex-col gap-6">
        <div className="flex-1 flex flex-col gap-4 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 h-fit">
          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Vouch Collection Channel</label>
            <p className="mb-3 text-xs text-discord-text-muted">Vouches submitted by users will be posted to this channel.</p>
            <ChannelSelect
              guildId={guildId}
              value={config.channel_id?.toString() || ""}
              onChange={(id) => setConfig({ channel_id: id })}
              placeholder="Select vouch channel..."
            />
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="xl:w-96 w-full shrink-0 flex flex-col gap-2">
          <h4 className="text-xs font-bold text-discord-text-muted uppercase tracking-wider pl-1">Embed Preview</h4>
          <div className="flex-1 bg-[#313338] rounded-xl border border-[#1E1F22] p-4 shadow-inner flex flex-col justify-center">
            <DiscordMessagePreview
              botName="Seisen Bot"
              timestamp="Today at 1:15 PM"
              title="⭐⭐⭐⭐⭐ New Vouch!"
              description="**User:** <@123456789>\n**Comment:** Fast delivery and very polite!"
              color="#f1c40f"
              footerText="Vouch #402"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

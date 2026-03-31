"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { DiscordMessagePreview } from "@/components/ui/discord-message";

export default function BoostRewardsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [config, setConfig] = useState<any>({ roles: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/boost`)
      .then((data) => setConfig(data || { roles: [] }))
      .catch(() => toast("Failed to load boost config", "error"));
  }, [guildId, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/boost`, undefined, {
        method: "PUT",
        body: JSON.stringify({
          ...config,
          roles: (config.roles || []).map(String),
          channel_id: config.channel_id || null,
          category_id: config.category_id || null,
        }),
      });
      toast("Boost Config Saved!");
    } catch (e) {
      toast("Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, val: any) => setConfig({ ...config, [key]: val });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Server Boost Rewards</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Config"}
        </Button>
      </div>

      <div className="flex xl:flex-row flex-col gap-6">
        <div className="flex-1 flex flex-col gap-6 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
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
              description="Thank you **Seisen88** for boosting the server!\nPlease click the button below to open a ticket and claim your boost rewards!"
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

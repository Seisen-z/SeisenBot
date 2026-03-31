"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { DiscordMessagePreview } from "@/components/ui/discord-message";

export default function VouchSystemPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [config, setConfig] = useState<any>({ channel_id: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/vouch`)
      .then((data) => setConfig(data || { channel_id: null }))
      .catch(() => toast("Failed to load vouch config", "error"));
  }, [guildId, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/vouch`, undefined, {
        method: "PUT",
        body: JSON.stringify({ channel_id: config.channel_id || null }),
      });
      toast("Vouch Config Saved!");
    } catch (e) {
      toast("Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Vouch System</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Config"}
        </Button>
      </div>

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

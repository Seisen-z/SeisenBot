"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { TicketIcon } from "lucide-react";

export default function TicketsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  
  const [config, setConfig] = useState<any>({ support_role_ids: [] });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [posting, setPosting] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/tickets`)
      .then((data) => setConfig(data || { support_role_ids: [] }))
      .catch(() => toast("Failed to load Tickets config", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistConfig = useCallback(async (nextConfig: any) => {
    await fetchApi(`/guilds/${guildId}/tickets`, undefined, {
      method: "PUT",
      body: JSON.stringify({
        ...nextConfig,
        support_role_ids: (nextConfig.support_role_ids || []).map(String),
        panel_channel_id: nextConfig.panel_channel_id || null,
        panel_message_id: nextConfig.panel_message_id || null,
        ticket_category_id: nextConfig.ticket_category_id || null,
        embed_title: nextConfig.embed_title || "",
        embed_description: nextConfig.embed_description || "",
        embed_color: nextConfig.embed_color || null,
        embed_thumbnail: nextConfig.embed_thumbnail || null,
        embed_footer: nextConfig.embed_footer || null,
      }),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: () => toast("Auto-save failed for tickets", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Tickets Config Saved!");
    } catch (e) {
      toast("Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRepostPanel = async () => {
    if (!config.panel_channel_id) {
      toast("Please configure and save a Panel Channel first.", "error");
      return;
    }
    setPosting(true);
    try {
      // Auto-save config first so the bot reads the latest embed settings
      await fetchApi(`/guilds/${guildId}/tickets`, undefined, {
        method: "PUT",
        body: JSON.stringify({
          ...config,
          support_role_ids: (config.support_role_ids || []).map(String),
          panel_channel_id: config.panel_channel_id || null,
          ticket_category_id: config.ticket_category_id || null,
          embed_title: config.embed_title || "",
          embed_description: config.embed_description || "",
          embed_color: config.embed_color || null,
          embed_thumbnail: config.embed_thumbnail || null,
          embed_footer: config.embed_footer || null,
        }),
      });

      // Now trigger the panel post, passing embed config directly so bot uses it
      await fetchApi('/trigger/ticket', undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_id: config.panel_channel_id,
            embed_title: config.embed_title || null,
            embed_description: config.embed_description || null,
            embed_color: config.embed_color || null,
            embed_footer: config.embed_footer || null,
            embed_thumbnail: config.embed_thumbnail || null,
          }
        })
      });
      toast("✅ Ticket Panel posted successfully!");
    } catch (err: any) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setPosting(false);
    }
  };


  const updateConfig = (key: string, val: any) => setConfig({ ...config, [key]: val });
  const openTicketCount = Object.keys(config.open_tickets || {}).length;
  const hasPanelChannel = Boolean(config.panel_channel_id);
  const hasCategory = Boolean(config.ticket_category_id);
  const supportRoleCount = (config.support_role_ids || []).length;

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={TicketIcon}
        title="Ticket System"
        subtitle="Configure your support panel, route tickets into categories, and control support team visibility."
        stats={[
          { label: "Panel Channel", value: hasPanelChannel ? "Configured" : "Missing" },
          { label: "Ticket Category", value: hasCategory ? "Configured" : "Missing" },
          { label: "Support Roles", value: supportRoleCount },
          { label: "Open Tickets", value: openTicketCount },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button variant="discord" onClick={handleRepostPanel} disabled={posting}>
              {posting ? "Posting..." : "Re-post Panel"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </div>
        }
      />

      <AdvancedEmbedEditor
        config={{
          title: config.embed_title,
          description: config.embed_description,
          color: config.embed_color,
          thumbnail_url: config.embed_thumbnail,
          footer: config.embed_footer
        }}
        onChange={(k, val) => {
          if (k === 'thumbnail_url') updateConfig('embed_thumbnail', val);
          else updateConfig(`embed_${k}`, val);
        }}
      >
        <div className="flex flex-col gap-4 border-b border-[#1E1F22] pb-6 mb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-discord-text-muted">Panel Channel</label>
              <ChannelSelect
                guildId={guildId}
                value={config.panel_channel_id?.toString() || ""}
                onChange={(id) => updateConfig("panel_channel_id", id)}
                placeholder="Post panel in..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-discord-text-muted">Ticket Category</label>
              <ChannelSelect
                guildId={guildId}
                value={config.ticket_category_id?.toString() || ""}
                onChange={(id) => updateConfig("ticket_category_id", id)}
                types={[4]}
                placeholder="Category for new tickets..."
                includeCategories
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-discord-text-muted">Support Roles</label>
            <RoleMultiSelect
              guildId={guildId}
              value={(config.support_role_ids || []).map(String)}
              onChange={(ids) => updateConfig("support_role_ids", ids)}
            />
          </div>
        </div>
      </AdvancedEmbedEditor>

      <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
        <h2 className="text-lg font-bold text-white mb-1">Live Status</h2>
        <div className="text-discord-text-muted text-sm">
          Active Open Tickets: <span className="font-bold text-discord-blurple">{openTicketCount}</span>
        </div>
      </div>
    </div>
  );
}

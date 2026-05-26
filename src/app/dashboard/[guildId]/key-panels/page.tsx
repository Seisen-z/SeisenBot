"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { Input } from "@/components/ui/input";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { Key, PlusIcon, Trash2Icon, LinkIcon, RefreshCwIcon, XIcon } from "lucide-react";

interface KeyPanelConfig {
  channel_id: string;
  message_id?: string;
  title: string;
  description: string;
  button_label: string;
  required_role_ids: string[];
  webhook_url?: string | null;
  webhook_secret?: string | null;
  webhook_hmac_header?: string | null;
  product_name?: string | null;
}

export default function KeyPanelsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [panels, setPanels] = useState<Record<string, KeyPanelConfig>>({});
  const [activePanelKey, setActivePanelKey] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const DEFAULT_PANEL: KeyPanelConfig = {
    channel_id: "",
    title: "🔑 Get Your License Key",
    description: "Click the button below to generate your private license key. Keep this key confidential and do not share it with anyone.",
    button_label: "Generate Key",
    required_role_ids: [],
    webhook_url: "",
    webhook_secret: "",
    webhook_hmac_header: "",
    product_name: ""
  };

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/keypanels`)
      .then((data: Record<string, KeyPanelConfig>) => {
        setPanels(data || {});
        const keys = Object.keys(data || {});
        if (keys.length > 0) setActivePanelKey(keys[0]);
        setInitialLoadComplete(true);
      })
      .catch((err) => {
        console.error("Load error:", err);
        toast("Failed to load key panels config", "error");
        setInitialLoadComplete(true);
      });
  }, [guildId, toast]);

  const currentPanel = panels[activePanelKey] || { ...DEFAULT_PANEL };

  const updatePanel = (key: keyof KeyPanelConfig, val: any) => {
    setPanels((prev) => {
      const existing = prev[activePanelKey] || { ...DEFAULT_PANEL };
      return {
        ...prev,
        [activePanelKey]: { ...existing, [key]: val }
      };
    });
  };

  const handleSave = async () => {
    // Save configurations to API (only persists the JSON file; doesn't edit Discord message)
    setSaving(true);
    try {
      // Clean draft keys from being sent to backend if they aren't posted
      const cleanPanels: Record<string, KeyPanelConfig> = {};
      Object.entries(panels).forEach(([k, v]) => {
        if (!k.startsWith("draft_")) {
          cleanPanels[k] = v;
        }
      });

      await fetchApi(`/guilds/${guildId}/keypanels`, undefined, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanPanels),
      });
      setLastSaved(new Date());
      toast("Key Panels Configuration Saved!");
    } catch (e: any) {
      toast(e?.message || "Failed to save configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePostPanel = async () => {
    if (!currentPanel.channel_id) {
      toast("Please select a target channel first.", "error");
      return;
    }
    if (!currentPanel.title.trim() || !currentPanel.description.trim()) {
      toast("Embed title and description are required.", "error");
      return;
    }

    setPosting(true);
    try {
      // Trigger posting of a new panel message on Discord
      const res = await fetchApi(`/trigger/keypanel_post`, undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_id: currentPanel.channel_id,
            title: currentPanel.title,
            description: currentPanel.description,
            button_label: currentPanel.button_label || "Generate Key",
            required_role_ids: currentPanel.required_role_ids,
            webhook_url: currentPanel.webhook_url || null,
            webhook_secret: currentPanel.webhook_secret || null,
            webhook_hmac_header: currentPanel.webhook_hmac_header || null,
            product_name: currentPanel.product_name || null,
          }
        })
      });

      if (res?.message_id) {
        const msgId = String(res.message_id);
        const postedPanel = {
          ...currentPanel,
          message_id: msgId
        };

        setPanels((prev) => {
          const updated = { ...prev };
          delete updated[activePanelKey]; // Delete the draft entry
          updated[msgId] = postedPanel; // Add the live entry
          return updated;
        });
        setActivePanelKey(msgId);
        toast("✅ Key Panel posted to channel successfully!");
      } else {
        throw new Error("No message ID returned from bot trigger.");
      }
    } catch (err: any) {
      toast(`Failed to post panel: ${err.message}`, "error");
    } finally {
      setPosting(false);
    }
  };

  const handleUpdatePanel = async () => {
    if (!currentPanel.message_id) return;
    if (!currentPanel.channel_id) {
      toast("Please configure a target channel.", "error");
      return;
    }

    setUpdating(true);
    try {
      // Trigger updating of the existing panel message on Discord
      await fetchApi(`/trigger/keypanel_update`, undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            message_id: currentPanel.message_id,
            title: currentPanel.title,
            description: currentPanel.description,
            button_label: currentPanel.button_label || "Generate Key",
            required_role_ids: currentPanel.required_role_ids,
            webhook_url: currentPanel.webhook_url || null,
            webhook_secret: currentPanel.webhook_secret || null,
            webhook_hmac_header: currentPanel.webhook_hmac_header || null,
            product_name: currentPanel.product_name || null,
          }
        })
      });
      toast("✅ Discord panel message updated successfully!");
    } catch (err: any) {
      toast(`Failed to update panel: ${err.message}`, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePanel = async () => {
    if (!confirm("Are you sure you want to delete this key panel? This will delete the message from Discord and remove its config.")) return;

    if (activePanelKey.startsWith("draft_")) {
      // Draft deletion is client-side only
      setPanels((prev) => {
        const updated = { ...prev };
        delete updated[activePanelKey];
        return updated;
      });
      setActivePanelKey(Object.keys(panels)[0] || "");
      toast("Draft removed.");
      return;
    }

    try {
      await fetchApi(`/guilds/${guildId}/keypanels/${activePanelKey}`, undefined, {
        method: "DELETE"
      });
      setPanels((prev) => {
        const updated = { ...prev };
        delete updated[activePanelKey];
        return updated;
      });
      setActivePanelKey(Object.keys(panels)[0] || "");
      toast("🗑️ Key Panel deleted successfully.");
    } catch (err: any) {
      toast(`Failed to delete panel: ${err.message}`, "error");
    }
  };

  const addDraftPanel = () => {
    const draftId = `draft_${Date.now()}`;
    setPanels((prev) => ({
      ...prev,
      [draftId]: { ...DEFAULT_PANEL }
    }));
    setActivePanelKey(draftId);
  };

  const handleRolesChange = (newRoles: string[]) => {
    if (newRoles.length > 5) {
      toast("Maximum 5 required roles are allowed for key panels.", "error");
      return;
    }
    updatePanel("required_role_ids", newRoles);
  };

  const totalPanels = Object.keys(panels).filter(k => !k.startsWith("draft_")).length;
  const draftCount = Object.keys(panels).filter(k => k.startsWith("draft_")).length;

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={Key}
        title="Key Panels"
        subtitle="Manage secure, ephemeral key generator panels. Create button actions configured with HMAC webhooks and role gates."
        stats={[
          { label: "Live Panels", value: totalPanels },
          { label: "Panel Drafts", value: draftCount },
          { label: "Target Channel", value: currentPanel.channel_id ? "Selected" : "None" },
          { label: "Required Roles", value: (currentPanel.required_role_ids || []).length },
        ]}
        actions={
          <div className="flex gap-2 items-center">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400 mr-1">Saved recently</span>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">
              {saving ? "Saving..." : "Save Drafts"}
            </Button>
            {activePanelKey && !activePanelKey.startsWith("draft_") ? (
              <Button variant="discord" onClick={handleUpdatePanel} disabled={updating} size="sm">
                {updating ? "Updating..." : "Update Live Panel"}
              </Button>
            ) : activePanelKey ? (
              <Button variant="discord" onClick={handlePostNow} disabled={posting} size="sm">
                {posting ? "Posting..." : "Post to Channel"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex gap-6 h-full min-h-[650px] flex-col lg:flex-row">
        {/* Left sidebar: Panels List */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 h-fit">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Saved Panels</span>
            <button
              onClick={addDraftPanel}
              className="flex items-center gap-1 text-xs text-discord-text-muted hover:text-white bg-[#1E1F22] hover:bg-discord-blurple rounded-md px-2 py-1 transition-all"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Add New
            </button>
          </div>

          {Object.keys(panels).length === 0 && (
            <p className="text-xs text-discord-text-muted px-2 py-4 text-center opacity-60">No panels configured.</p>
          )}

          <div className="flex flex-col gap-1 max-h-[350px] lg:max-h-none overflow-y-auto custom-scrollbar">
            {Object.entries(panels).map(([key, panel]) => {
              const isDraft = key.startsWith("draft_");
              const isSelected = activePanelKey === key;
              return (
                <div key={key} className="flex items-center group">
                  <button
                    onClick={() => setActivePanelKey(key)}
                    className={`flex-1 text-left text-sm px-3 py-2 rounded-lg transition-all truncate flex items-center gap-2 ${
                      isSelected
                        ? "bg-discord-blurple text-white font-medium shadow-md"
                        : "text-discord-text hover:bg-[#383A40]/70"
                    }`}
                  >
                    <span className="shrink-0">🔑</span>
                    <span className="truncate">{panel.title || "Untitled Panel"}</span>
                    {isDraft && (
                      <span className="ml-auto text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1 rounded uppercase shrink-0">
                        Draft
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activePanelKey === key) handleDeletePanel();
                      else {
                        setActivePanelKey(key);
                        setTimeout(() => handleDeletePanel(), 50);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-red-400 hover:text-red-300 p-1.5 rounded transition-all shrink-0"
                    title={isDraft ? "Remove Draft" : "Delete Panel"}
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right content: Form Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-0 relative overflow-hidden flex flex-col min-h-[500px]">
            {activePanelKey ? (
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-[#1E1F22] flex justify-between items-center bg-[#242529]">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>⚙️</span>
                    <span>Configuring: {currentPanel.title || "New Key Panel"}</span>
                  </h2>
                  {!activePanelKey.startsWith("draft_") && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-2.5 py-1 text-green-400 text-xs">
                      <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono truncate max-w-[120px] lg:max-w-none">Live ID: {currentPanel.message_id}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  <AdvancedEmbedEditor
                    config={{
                      title: currentPanel.title,
                      description: currentPanel.description,
                      color: "#5865F2",
                      footer: `Product: ${currentPanel.product_name || "Premium Key"}`
                    }}
                    onChange={(k, val) => {
                      if (k === "title") updatePanel("title", val);
                      else if (k === "description") updatePanel("description", val);
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#1E1F22] pb-6 mb-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-discord-text-muted uppercase tracking-wide">Target Channel</label>
                        <ChannelSelect
                          guildId={guildId}
                          value={currentPanel.channel_id || ""}
                          onChange={(id) => updatePanel("channel_id", id)}
                          placeholder="Post key panel in..."
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-discord-text-muted uppercase tracking-wide">Button Label</label>
                        <Input
                          value={currentPanel.button_label || ""}
                          onChange={(e) => updatePanel("button_label", e.target.value)}
                          placeholder="Generate Key"
                        />
                      </div>
                    </div>

                    <div className="border-b border-[#1E1F22] pb-6 mb-4">
                      <label className="mb-2 block text-xs font-semibold text-discord-text-muted uppercase tracking-wide">
                        Required Roles (Min 1, Max 5)
                      </label>
                      <RoleMultiSelect
                        guildId={guildId}
                        value={(currentPanel.required_role_ids || []).map(String)}
                        onChange={handleRolesChange}
                      />
                      <p className="text-[10px] text-discord-text-muted mt-1">
                        Allows users with any of these roles to click the button. Limit: 5 roles max.
                      </p>
                    </div>

                    <div className="pt-4">
                      <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">
                        Webhook & Product Settings (Optional Overrides)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block text-[11px] font-semibold text-discord-text-muted">Product Name Override</label>
                          <Input
                            value={currentPanel.product_name || ""}
                            onChange={(e) => updatePanel("product_name", e.target.value)}
                            placeholder="e.g. Premium Key"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-[11px] font-semibold text-discord-text-muted">Webhook URL Override</label>
                          <Input
                            value={currentPanel.webhook_url || ""}
                            onChange={(e) => updatePanel("webhook_url", e.target.value)}
                            placeholder="https://api.jnkie.com/..."
                            type="password"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-[11px] font-semibold text-discord-text-muted">HMAC Secret Override</label>
                          <Input
                            value={currentPanel.webhook_secret || ""}
                            onChange={(e) => updatePanel("webhook_secret", e.target.value)}
                            placeholder="Custom HMAC signature secret"
                            type="password"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-[11px] font-semibold text-discord-text-muted">HMAC Header Name Override</label>
                          <Input
                            value={currentPanel.webhook_hmac_header || ""}
                            onChange={(e) => updatePanel("webhook_hmac_header", e.target.value)}
                            placeholder="default: seisen"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-discord-text-muted mt-2">
                        💡 Leave overrides empty to fall back to the bot's default webhook configuration configured in `.env`.
                      </p>
                    </div>
                  </AdvancedEmbedEditor>

                  <div className="flex gap-3 justify-end mt-8 border-t border-[#1E1F22] pt-6">
                    <Button variant="outline" className="border-red-500/20 hover:bg-red-500/5 text-red-400" onClick={handleDeletePanel}>
                      <Trash2Icon className="w-3.5 h-3.5 mr-1.5" />
                      {activePanelKey.startsWith("draft_") ? "Discard Draft" : "Delete Panel"}
                    </Button>
                    {activePanelKey.startsWith("draft_") ? (
                      <Button variant="discord" onClick={handlePostPanel} disabled={posting}>
                        {posting ? "Posting..." : "Post Panel to Discord"}
                      </Button>
                    ) : (
                      <Button variant="discord" onClick={handleUpdatePanel} disabled={updating}>
                        {updating ? "Updating..." : "Update Live Message"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-discord-text-muted flex h-[500px] flex-col items-center justify-center gap-4">
                <div className="p-6 rounded-full bg-[#313338] border border-[#1E1F22]">
                  <Key className="w-12 h-12 text-discord-blurple opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">Key Panel Configurator</p>
                  <p className="text-sm text-discord-text-muted max-w-xs mx-auto mt-1">
                    Select an existing key panel to edit, or create a new draft to post in your Discord channels.
                  </p>
                </div>
                <Button variant="discord" className="mt-2" onClick={addDraftPanel}>
                  <PlusIcon className="w-4 h-4 mr-2" /> Add Key Panel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Helper alias to trigger submit
  function handlePostNow() {
    if (activePanelKey.startsWith("draft_")) {
      handlePostPanel();
    } else {
      handleUpdatePanel();
    }
  }
}

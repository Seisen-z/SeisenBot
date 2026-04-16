"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { MessageSquareIcon, PlusIcon, Trash2Icon, SendIcon, StickyNoteIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

type Stickies = Record<string, { name?: string; title?: string; content: string; color?: number }>;

export default function StickyMessagesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [stickies, setStickies] = useState<Stickies>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [newChannelId, setNewChannelId] = useState("");

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/sticky`)
      .then((data) => {
        const d = data || {};
        setStickies(d);
        const keys = Object.keys(d);
        if (keys.length > 0) setActiveChannelId(keys[0]);
      })
      .catch(() => toast("Failed to load Sticky Messages", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistStickies = useCallback(async (nextStickies: Stickies) => {
    await fetchApi(`/guilds/${guildId}/sticky`, undefined, {
      method: "PUT",
      body: JSON.stringify(nextStickies),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: stickies,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistStickies,
    onError: (err: any) => toast(err?.message || "Auto-save failed for sticky messages", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistStickies(stickies);
      toast("Sticky Messages Config Saved!");
    } catch (e: any) {
        toast(e?.message || "Failed to save.", "error");
      } finally {
      setSaving(false);
    }
  };

  const handleSendSticky = async (channelId: string) => {
    if (!stickies[channelId]) return;
    setSending(channelId);
    try {
      await fetchApi('/trigger/sticky', undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: { channel_id: channelId, ...stickies[channelId] }
        })
      });
      toast("Sticky message triggered!");
    } catch (err: any) {
      toast(`Error posting: ${err.message}`, "error");
    } finally {
      setSending(null);
    }
  };

  const addSticky = () => {
    if (!newChannelId) { toast("Select a channel first.", "error"); return; }
    if (stickies[newChannelId]) { toast("A sticky already exists for that channel.", "error"); return; }
    
    setStickies({ ...stickies, [newChannelId]: { name: "New Sticky", title: "", content: "Write your sticky message here...", color: 5793266 } });
    setActiveChannelId(newChannelId);
    setNewChannelId("");
  };

  const updateActiveSticky = (key: string, value: any) => {
    if (!activeChannelId) return;
    setStickies(prev => ({
      ...prev,
      [activeChannelId]: { ...prev[activeChannelId], [key]: value }
    }));
  };

  const activeData = activeChannelId ? stickies[activeChannelId] : null;
  const stickyCount = Object.keys(stickies).length;

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={StickyNoteIcon}
        title="Sticky Messages"
        subtitle="Pin recurring reminders to key channels and force-send updated copies whenever needed."
        stats={[
          { label: "Configured Stickies", value: stickyCount },
          { label: "Active Channel", value: activeChannelId || "None" },
          { label: "Ready To Send", value: activeData?.content ? "Yes" : "No" },
          { label: "Auto Update", value: "Enabled" },
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

      <div className="flex gap-6 h-[calc(100vh-160px)] min-h-[500px]">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 px-1 pb-4 border-b border-[#1E1F22]">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Stickies</span>
          </div>

          <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-[#1E1F22]">
            <ChannelSelect
              guildId={guildId}
              value={newChannelId}
              onChange={setNewChannelId}
              placeholder="Select channel..."
              className="text-xs"
            />
            <Button variant="outline" size="sm" onClick={addSticky} className="bg-[#1E1F22] border-transparent hover:bg-discord-blurple">
              <PlusIcon className="w-3 h-3 mr-1" /> Add Sticky Channel
            </Button>
          </div>

          {Object.keys(stickies).length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-60">
              <StickyNoteIcon className="w-8 h-8 mb-2 text-discord-text-muted" />
              <p className="text-xs text-discord-text-muted">No stickies setup.<br />Select a channel above.</p>
            </div>
          )}

          {Object.entries(stickies).map(([channelId, data]) => {
            const displayName = data.name || `Sticky in ${channelId}`;
            
            return (
              <button
                key={channelId}
                onClick={() => setActiveChannelId(channelId)}
                className={`flex flex-col items-start gap-1 text-left px-3 py-2 rounded-md transition-colors ${
                  activeChannelId === channelId 
                    ? 'bg-discord-blurple text-white shadow-sm' 
                    : 'text-discord-text hover:bg-[#383A40]'
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <StickyNoteIcon className={`w-4 h-4 shrink-0 ${activeChannelId === channelId ? 'text-white/80' : 'text-discord-text-muted/60'}`} />
                  <span className={`truncate flex-1 font-medium text-sm ${activeChannelId === channelId ? 'text-white' : 'text-discord-text-muted'}`}>{displayName}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 relative overflow-y-auto">
            {activeData && activeChannelId ? (
              <div className="flex flex-col gap-6 h-full">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-white">
                      {activeData.name || "Sticky Configuration"}
                    </h2>
                    <span className="text-xs font-mono text-discord-text-muted bg-[#1E1F22] px-2 py-0.5 rounded mt-1 w-fit">
                      Channel ID: {activeChannelId}
                    </span>
                  </div>
                  <Button
                    variant="discord"
                    onClick={() => handleSendSticky(activeChannelId)}
                    disabled={sending === activeChannelId}
                    className="flex shadow-none"
                  >
                    <SendIcon className="w-4 h-4 mr-2" />
                    {sending === activeChannelId ? "Sending..." : "Send / Force Update"}
                  </Button>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[13px] font-semibold text-discord-text-muted">Sticky Custom Name</label>
                  <Input 
                    value={activeData.name || ""} 
                    onChange={(e) => updateActiveSticky("name", e.target.value)} 
                    placeholder="e.g. Server Rules Sticky"
                  />
                </div>

                <AdvancedEmbedEditor
                  config={{
                    content: activeData.content,
                    title: activeData.title,
                    description: activeData.content, // Currently sticky logic merges this or uses content for description based on UI
                    color: activeData.color
                  }}
                  onChange={(k: string, val: any) => {
                    if (k === 'description' || k === 'content') updateActiveSticky('content', val);
                    else if (k === 'title') updateActiveSticky('title', val);
                    else if (k === 'color') updateActiveSticky('color', val);
                  }}
                />

                <div className="flex justify-end pt-2 mt-auto">
                  <Button 
                    variant="ghost" 
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300" 
                    onClick={() => {
                      const newS = { ...stickies };
                      delete newS[activeChannelId];
                      setStickies(newS);
                      const remaining = Object.keys(newS);
                      setActiveChannelId(remaining.length > 0 ? remaining[0] : null);
                    }}
                  >
                    <Trash2Icon className="w-4 h-4 mr-1.5" /> Delete Channel Sticky
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-discord-text-muted flex h-full flex-col items-center justify-center gap-3">
                <StickyNoteIcon className="w-12 h-12 opacity-20" />
                <p className="text-sm">Select a sticky channel to edit, or add a new channel.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

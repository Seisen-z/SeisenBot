"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { Input } from "@/components/ui/input";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, Trash2Icon, FolderIcon, EditIcon } from "lucide-react";
import { PromptModal } from "@/components/ui/prompt-modal";

// Draft key format: "Category/DraftName" — uncategorized uses "General/DraftName"
const DEFAULT_CATEGORY = "General";

type AnnouncementDraft = {
  title: string;
  description: string;
  thumbnail_url: string;
  image_url: string;
  footer: string;
  channel_id: string;
  ping_role_id: string;
  [key: string]: any;
};

const createEmptyDraft = (): AnnouncementDraft => ({
  title: "",
  description: "",
  thumbnail_url: "",
  image_url: "",
  footer: "",
  channel_id: "",
  ping_role_id: "",
});

function normalizeDraft(input: any): AnnouncementDraft {
  const nestedContent =
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    input.content &&
    typeof input.content === "object" &&
    !Array.isArray(input.content)
      ? input.content
      : input;

  const source =
    nestedContent && typeof nestedContent === "object" && !Array.isArray(nestedContent)
      ? nestedContent
      : {};

  return {
    ...createEmptyDraft(),
    ...source,
    title: typeof source.title === "string" ? source.title : "",
    description: typeof source.description === "string" ? source.description : "",
    thumbnail_url: typeof source.thumbnail_url === "string" ? source.thumbnail_url : "",
    image_url: typeof source.image_url === "string" ? source.image_url : "",
    footer: typeof source.footer === "string" ? source.footer : "",
    channel_id: typeof source.channel_id === "string" ? source.channel_id : "",
    ping_role_id: typeof source.ping_role_id === "string" ? source.ping_role_id : "",
  };
}

function normalizeDraftMap(rawDrafts: Record<string, any>): Record<string, AnnouncementDraft> {
  const normalized: Record<string, AnnouncementDraft> = {};

  for (const [key, value] of Object.entries(rawDrafts || {})) {
    normalized[key] = normalizeDraft(value);
  }

  return normalized;
}

function parseDrafts(drafts: Record<string, any>) {
  // Returns { [category]: [draftKey, ...] }
  const map: Record<string, string[]> = {};
  for (const key of Object.keys(drafts)) {
    const parts = key.split("/");
    const cat = parts.length > 1 ? parts[0] : DEFAULT_CATEGORY;
    if (!map[cat]) map[cat] = [];
    map[cat].push(key);
  }
  return map;
}

export default function AnnouncementsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, AnnouncementDraft>>({});
  const [activeDraftKey, setActiveDraftKey] = useState<string>("");
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [posting, setPosting] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<{title: string; label: string; action: 'category' | 'draft' | 'rename'; cat?: string; draftKey?: string}>({
    title: "", label: "", action: "category"
  });

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/announcements`)
      .then((data) => {
        const normalizedDrafts = normalizeDraftMap(data || {});
        setDrafts(normalizedDrafts);
        const keys = Object.keys(normalizedDrafts);
        if (keys.length > 0) setActiveDraftKey(keys[0]);
      })
      .catch(() => toast("Failed to load announcements", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistDrafts = useCallback(async (nextDrafts: Record<string, AnnouncementDraft>) => {
    const payload = normalizeDraftMap(nextDrafts);
    await fetchApi(`/guilds/${guildId}/announcements`, undefined, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: drafts,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistDrafts,
    onError: () => toast("Auto-save failed for announcements", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistDrafts(drafts);
      toast("Drafts Saved Successfully!");
    } catch (e) {
      toast("Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const currentDraft = drafts[activeDraftKey] || createEmptyDraft();

  const updateDraft = (key: string, val: any) => {
    setDrafts((prev) => {
      if (!activeDraftKey) return prev;
      return {
        ...prev,
        [activeDraftKey]: {
          ...(prev[activeDraftKey] || createEmptyDraft()),
          [key]: val,
        },
      };
    });
  };

  const handlePostNow = async () => {
    if (!currentDraft.channel_id) {
      toast("Select a target channel first.", "error");
      return;
    }
    setPosting(true);
    try {
      const announcementPayload = {
        ...currentDraft,
        ping_role_id: currentDraft.ping_role_id || null,
      };

      await fetchApi('/trigger/announcement', undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: announcementPayload,
        })
      });
      toast("Announcement Posted Successfully!");
    } catch (err: any) {
      toast(`Error posting: ${err.message}`, "error");
    } finally {
      setPosting(false);
    }
  };

  const addCategory = () => {
    setPromptConfig({ title: "New Category", label: "Category Name", action: "category" });
    setPromptOpen(true);
  };

  const addDraftToCategory = (cat: string) => {
    setPromptConfig({ title: "New Draft", label: "Draft Name", action: "draft", cat });
    setPromptOpen(true);
  };

  const renameDraft = (key: string) => {
    const currentName = draftLabel(key);
    setPromptConfig({ title: "Rename Draft", label: "Draft Name", action: "rename", draftKey: key });
    setPromptOpen(true);
  };

  const handlePromptConfirm = (value: string) => {
    if (promptConfig.action === "category") {
      const key = `${value}/${value} Draft 1`;
      if (!drafts[key]) {
        setDrafts(prev => ({ ...prev, [key]: createEmptyDraft() }));
        setActiveDraftKey(key);
      }
    } else if (promptConfig.action === "draft" && promptConfig.cat) {
      const cat = promptConfig.cat;
      const key = `${cat}/${value}`;
      if (drafts[key]) {
        toast("A draft with that name already exists.", "error");
      } else {
        setDrafts(prev => ({ ...prev, [key]: createEmptyDraft() }));
        setActiveDraftKey(key);
      }
    } else if (promptConfig.action === "rename" && promptConfig.draftKey) {
      const oldKey = promptConfig.draftKey;
      const category = oldKey.split("/")[0];
      const newKey = `${category}/${value}`;
      
      if (newKey === oldKey) {
        // No change needed
      } else if (drafts[newKey]) {
        toast("A draft with that name already exists.", "error");
        return;
      } else {
        // Rename the draft
        const oldKeySafe = encodeURIComponent(oldKey);
        fetchApi(`/guilds/${guildId}/announcements/${oldKeySafe}/rename`, undefined, {
          method: "POST",
          body: JSON.stringify({ new_name: newKey }),
        }).catch(e => console.error("Rename failed", e));
        
        const updated = { ...drafts };
        updated[newKey] = updated[oldKey];
        delete updated[oldKey];
        setDrafts(updated);
        setActiveDraftKey(newKey);
        toast("Draft renamed successfully!");
      }
    }
    setPromptOpen(false);
  };

  const deleteDraft = (key: string) => {
    const keySafe = encodeURIComponent(key);
    fetchApi(`/guilds/${guildId}/announcements/${keySafe}`, undefined, {
      method: "DELETE",
    }).catch(e => console.error("Delete failed", e));
    
    const updated = { ...drafts };
    delete updated[key];
    setDrafts(updated);
    setActiveDraftKey(Object.keys(updated)[0] || "");
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categorized = parseDrafts(drafts);

  // Draft display name (strip category prefix)
  const draftLabel = (key: string) => {
    const parts = key.split("/");
    return parts.length > 1 ? parts.slice(1).join("/") : key;
  };

  const categoryCount = Object.keys(categorized).length;
  const draftCount = Object.keys(drafts).length;
  const activeCategory = activeDraftKey ? activeDraftKey.split("/")[0] : "None";

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={FolderIcon}
        title="Announcements Manager"
        subtitle="Organize announcement drafts by category, edit rich embeds, and post instantly when ready."
        stats={[
          { label: "Categories", value: categoryCount },
          { label: "Total Drafts", value: draftCount },
          { label: "Active Category", value: activeCategory },
          { label: "Ready To Post", value: currentDraft.channel_id ? "Yes" : "No" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Drafts"}
            </Button>
          </div>
        }
      />

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-60 shrink-0 flex flex-col gap-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 h-fit">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Drafts</span>
            <button
              title="New Category"
              onClick={addCategory}
              className="flex items-center gap-1 text-xs text-discord-text-muted hover:text-white bg-[#1E1F22] hover:bg-discord-blurple rounded-md px-2 py-1 transition"
            >
              <PlusIcon className="w-3 h-3" /> Category
            </button>
          </div>

          {Object.keys(categorized).length === 0 && (
            <p className="text-xs text-discord-text-muted px-2 py-3 text-center opacity-60">No drafts yet. Add a category!</p>
          )}

          {Object.entries(categorized).map(([cat, keys]) => (
            <div key={cat} className="mb-1">
              {/* Category header */}
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-[#383A40] group">
                <button
                  className="flex items-center gap-1.5 flex-1 text-left"
                  onClick={() => toggleCategory(cat)}
                >
                  {collapsedCats[cat]
                    ? <ChevronRightIcon className="w-3.5 h-3.5 text-discord-text-muted shrink-0" />
                    : <ChevronDownIcon className="w-3.5 h-3.5 text-discord-text-muted shrink-0" />}
                  <FolderIcon className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span className="text-sm font-semibold text-discord-text truncate">{cat}</span>
                </button>
                <button
                  title={`Add draft to ${cat}`}
                  onClick={() => addDraftToCategory(cat)}
                  className="opacity-0 group-hover:opacity-100 text-discord-text-muted hover:text-white bg-[#313338] hover:bg-discord-blurple rounded p-0.5 transition"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Drafts in this category */}
              {!collapsedCats[cat] && (
                <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-[#1E1F22] pl-2">
                  {keys.map(key => (
                    <div key={key} className="flex items-center group/item">
                      <button
                        onClick={() => setActiveDraftKey(key)}
                        className={`flex-1 text-left text-sm px-2 py-1.5 rounded-md transition-colors truncate ${
                          activeDraftKey === key
                            ? 'bg-discord-blurple text-white font-medium'
                            : 'text-discord-text hover:bg-[#383A40]'
                        }`}
                      >
                        {draftLabel(key)}
                      </button>
                      <button
                        onClick={() => renameDraft(key)}
                        className="opacity-0 group-hover/item:opacity-100 ml-1 text-yellow-400 hover:text-yellow-300 shrink-0 p-0.5 rounded"
                        title="Rename draft"
                      >
                        <EditIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteDraft(key)}
                        className="opacity-0 group-hover/item:opacity-100 ml-1 text-red-400 hover:text-red-300 shrink-0 p-0.5 rounded"
                        title="Delete draft"
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {keys.length === 0 && (
                    <span className="text-xs text-discord-text-muted px-2 py-1 opacity-50">Empty</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Editor Panel */}
        <div className="flex-1">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 relative h-full">
            {activeDraftKey ? (
              <div className="flex flex-col gap-4 h-full">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-xs text-discord-text-muted">{activeDraftKey.split("/")[0]}</p>
                    <h2 className="text-xl font-bold text-white">{draftLabel(activeDraftKey)}</h2>
                  </div>
                  <Button variant="discord" onClick={handlePostNow} disabled={posting} size="sm">
                    {posting ? "Posting..." : "🚀 Post Now"}
                  </Button>
                </div>

                <AdvancedEmbedEditor
                  config={currentDraft}
                  onChange={updateDraft}
                >
                  <div className="grid grid-cols-2 gap-4 border-b border-[#1E1F22] pb-6 mb-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Target Channel</label>
                      <ChannelSelect
                        guildId={guildId}
                        value={currentDraft.channel_id || ""}
                        onChange={(id) => updateDraft("channel_id", id)}
                        placeholder="Select channel..."
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Ping Role</label>
                      <RoleSelect
                        guildId={guildId}
                        value={currentDraft.ping_role_id || ""}
                        onChange={(id) => updateDraft("ping_role_id", id)}
                        placeholder="No ping..."
                      />
                    </div>
                  </div>
                </AdvancedEmbedEditor>

                <div className="mt-2 text-right">
                  <Button
                    variant="ghost"
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => deleteDraft(activeDraftKey)}
                  >
                    <Trash2Icon className="w-4 h-4 mr-1.5" /> Delete Draft
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-discord-text-muted flex h-[400px] flex-col items-center justify-center gap-3">
                <FolderIcon className="w-12 h-12 opacity-20" />
                <p className="text-sm">Add a category and draft to get started.</p>
                <Button variant="outline" size="sm" onClick={addCategory}>
                  <PlusIcon className="w-4 h-4 mr-1" /> New Category
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PromptModal
        open={promptOpen}
        title={promptConfig.title}
        label={promptConfig.label}
        defaultValue={promptConfig.action === "rename" && promptConfig.draftKey ? draftLabel(promptConfig.draftKey) : ""}
        onConfirm={handlePromptConfirm}
        onCancel={() => setPromptOpen(false)}
      />
    </div>
  );
}

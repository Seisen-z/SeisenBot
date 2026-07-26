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
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  FolderIcon,
  EditIcon,
  SmileIcon,
} from "lucide-react";
import { PromptModal } from "@/components/ui/prompt-modal";

const DEFAULT_CATEGORY = "General";

type AnnouncementButton = { label: string; url: string };

type AnnouncementDraft = {
  title: string;
  description: string;
  thumbnail_url: string;
  image_url: string;
  images: string[];
  footer: string;
  channel_id: string;
  ping_role_id: string;
  buttons: AnnouncementButton[];
  auto_reactions: string[];
  [key: string]: any;
};

const createEmptyDraft = (): AnnouncementDraft => ({
  title: "",
  description: "",
  thumbnail_url: "",
  image_url: "",
  images: [],
  footer: "",
  channel_id: "",
  ping_role_id: "",
  buttons: [],
  auto_reactions: [],
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

  let auto_reactions: string[] = [];
  if (Array.isArray(source.auto_reactions)) {
    auto_reactions = source.auto_reactions.filter((r: any) => typeof r === "string" && r.trim());
  } else if (typeof source.auto_reactions === "string" && source.auto_reactions.trim()) {
    auto_reactions = source.auto_reactions.split(",").map((r: string) => r.trim()).filter(Boolean);
  }

  return {
    ...createEmptyDraft(),
    ...source,
    title: typeof source.title === "string" ? source.title : "",
    description: typeof source.description === "string" ? source.description : "",
    thumbnail_url: typeof source.thumbnail_url === "string" ? source.thumbnail_url : "",
    image_url: typeof source.image_url === "string" ? source.image_url : "",
    images: Array.isArray(source.images) ? source.images.filter((i: any) => typeof i === "string") : [],
    footer: typeof source.footer === "string" ? source.footer : "",
    channel_id: typeof source.channel_id === "string" ? source.channel_id : "",
    ping_role_id: typeof source.ping_role_id === "string" ? source.ping_role_id : "",
    buttons: Array.isArray(source.buttons)
      ? source.buttons
          .filter((b: any) => b && typeof b === "object")
          .map((b: any) => ({
            label: typeof b.label === "string" ? b.label : "",
            url: typeof b.url === "string" ? b.url : "",
          }))
          .slice(0, 5)
      : [],
    auto_reactions,
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
  const [posting, setPosting] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<{
    title: string;
    label: string;
    action: "category" | "draft" | "rename";
    cat?: string;
    draftKey?: string;
  }>({
    title: "",
    label: "",
    action: "category",
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

  const persistDrafts = useCallback(
    async (nextDrafts: Record<string, AnnouncementDraft>) => {
      const payload = normalizeDraftMap(nextDrafts);
      await fetchApi(`/guilds/${guildId}/announcements`, undefined, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    [guildId]
  );

  useDebouncedAutoSave({
    value: drafts,
    enabled: initialLoadComplete,
    delay: 1500,
    onSave: persistDrafts,
    onError: (err: any) => toast(err?.message || "Auto-save failed for announcements", "error"),
  });

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

  const updateButton = (idx: number, field: "label" | "url", value: string) => {
    const newButtons = [...(currentDraft.buttons || [])];
    newButtons[idx] = { ...(newButtons[idx] || { label: "", url: "" }), [field]: value };
    updateDraft("buttons", newButtons);
  };

  const addButton = () => {
    updateDraft("buttons", [...(currentDraft.buttons || []), { label: "New Button", url: "https://" }]);
  };

  const removeButton = (idx: number) => {
    updateDraft("buttons", (currentDraft.buttons || []).filter((_, i) => i !== idx));
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
        name: activeDraftKey,
        ping_role_id: currentDraft.ping_role_id || null,
        auto_reactions: currentDraft.auto_reactions || [],
      };

      await fetchApi("/trigger/announcement", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: announcementPayload,
        }),
      });
      toast("Announcement Published Successfully!");
    } catch (err: any) {
      toast(`Error posting: ${err.message}`, "error");
    } finally {
      setPosting(false);
    }
  };

  const addCategory = () => {
    setPromptConfig({
      title: "New Category",
      label: "Category Name",
      action: "category",
    });
    setPromptOpen(true);
  };

  const addDraft = (cat: string) => {
    setPromptConfig({
      title: `New Draft in ${cat}`,
      label: "Draft Name",
      action: "draft",
      cat,
    });
    setPromptOpen(true);
  };

  const renameDraft = (draftKey: string) => {
    setPromptConfig({
      title: "Rename Draft",
      label: "New Name",
      action: "rename",
      draftKey,
    });
    setPromptOpen(true);
  };

  const deleteDraft = async (draftKey: string) => {
    if (!draftKey) return;
    const isConfirmed = window.confirm(`Are you sure you want to delete "${draftLabel(draftKey)}"?`);
    if (!isConfirmed) return;

    try {
      await fetchApi(`/guilds/${guildId}/announcements/${encodeURIComponent(draftKey)}`, undefined, {
        method: "DELETE",
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        const keys = Object.keys(next);
        if (activeDraftKey === draftKey) {
          setActiveDraftKey(keys.length > 0 ? keys[0] : "");
        }
        return next;
      });
      toast("Draft Deleted");
    } catch {
      toast("Failed to delete draft", "error");
    }
  };

  const handlePromptConfirm = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    if (promptConfig.action === "category") {
      const draftKey = `${trimmed}/Welcome`;
      const next = { ...drafts, [draftKey]: createEmptyDraft() };
      setDrafts(next);
      setActiveDraftKey(draftKey);
      await persistDrafts(next);
    } else if (promptConfig.action === "draft" && promptConfig.cat) {
      const draftKey = `${promptConfig.cat}/${trimmed}`;
      const next = { ...drafts, [draftKey]: createEmptyDraft() };
      setDrafts(next);
      setActiveDraftKey(draftKey);
      await persistDrafts(next);
    } else if (promptConfig.action === "rename" && promptConfig.draftKey) {
      const oldKey = promptConfig.draftKey;
      const parts = oldKey.split("/");
      const cat = parts.length > 1 ? parts[0] : DEFAULT_CATEGORY;
      const newKey = `${cat}/${trimmed}`;

      if (oldKey === newKey) {
        setPromptOpen(false);
        return;
      }

      try {
        await fetchApi(`/guilds/${guildId}/announcements/${encodeURIComponent(oldKey)}/rename`, undefined, {
          method: "POST",
          body: JSON.stringify({ new_name: newKey }),
        });
        setDrafts((prev) => {
          const next = { ...prev };
          const existingData = next[oldKey] || createEmptyDraft();
          delete next[oldKey];
          next[newKey] = existingData;
          if (activeDraftKey === oldKey) setActiveDraftKey(newKey);
          return next;
        });
        toast(`Renamed to ${trimmed}`);
      } catch {
        toast("Failed to rename draft", "error");
      }
    }
    setPromptOpen(false);
  };

  const draftLabel = (key: string) => {
    const parts = key.split("/");
    return parts.length > 1 ? parts.slice(1).join("/") : key;
  };

  const categories = parseDrafts(drafts);

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHero
        title="Announcement Studio"
        subtitle="Design rich announcement embeds, configure auto-reaction emojis, and publish announcements instantly."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-4 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Categories</span>
              <Button size="sm" variant="ghost" onClick={addCategory} className="h-7 text-xs text-discord-blurple">
                <PlusIcon className="w-3.5 h-3.5 mr-1" /> Category
              </Button>
            </div>

            <div className="space-y-2">
              {Object.keys(categories).length === 0 && (
                <p className="text-xs text-discord-text-muted italic text-center py-4">No categories created yet.</p>
              )}

              {Object.entries(categories).map(([cat, keys]) => {
                const isCollapsed = collapsedCats[cat];
                return (
                  <div key={cat} className="rounded-lg bg-[#1E1F22]/50 border border-white/5">
                    <div className="flex items-center justify-between p-2">
                      <button
                        onClick={() => setCollapsedCats((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                        className="flex items-center gap-1.5 text-xs font-bold text-white hover:text-discord-blurple transition-colors"
                      >
                        {isCollapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                        <FolderIcon className="w-3.5 h-3.5 text-discord-blurple" />
                        <span>{cat}</span>
                        <span className="text-[10px] text-discord-text-muted font-normal">({keys.length})</span>
                      </button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-discord-text-muted hover:text-white"
                        onClick={() => addDraft(cat)}
                        title="Add draft"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {!isCollapsed && (
                      <div className="pl-4 pr-2 pb-2 space-y-1">
                        {keys.map((key) => {
                          const isActive = activeDraftKey === key;
                          return (
                            <div
                              key={key}
                              className={`group flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                                isActive
                                  ? "bg-discord-blurple text-white font-semibold"
                                  : "text-discord-text-muted hover:bg-white/5 hover:text-white"
                              }`}
                              onClick={() => setActiveDraftKey(key)}
                            >
                              <span className="truncate">{draftLabel(key)}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="p-1 hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    renameDraft(key);
                                  }}
                                  title="Rename"
                                >
                                  <EditIcon className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-1 hover:text-red-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteDraft(key);
                                  }}
                                  title="Delete"
                                >
                                  <Trash2Icon className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 shadow-md">
            {activeDraftKey && currentDraft ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E1F22] pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{draftLabel(activeDraftKey)}</h2>
                    <p className="text-xs text-discord-text-muted">Category: {activeDraftKey.split("/")[0]}</p>
                  </div>
                  <Button
                    onClick={handlePostNow}
                    disabled={posting || !currentDraft.channel_id}
                    className="bg-discord-blurple hover:bg-discord-blurple/80 text-white font-semibold"
                  >
                    {posting ? "Publishing..." : "Publish Announcement"}
                  </Button>
                </div>

                <AdvancedEmbedEditor
                  config={{
                    content: currentDraft.content,
                    title: currentDraft.title,
                    description: currentDraft.description,
                    thumbnail_url: currentDraft.thumbnail_url,
                    image_url: currentDraft.image_url,
                    images: currentDraft.images,
                    footer: currentDraft.footer,
                  }}
                  onChange={(k, v) => updateDraft(k, v)}
                  bottomChildren={
                    <div className="space-y-4 pt-4 border-t border-[#1E1F22]">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Buttons (Up to 5 Link Buttons)</label>
                        <div className="space-y-2">
                          {(currentDraft.buttons || []).map((btn, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={btn.label || ""}
                                placeholder="Button Label"
                                onChange={(e) => updateButton(idx, "label", e.target.value)}
                                className="flex-1"
                              />
                              <Input
                                value={btn.url || ""}
                                placeholder="https://..."
                                onChange={(e) => updateButton(idx, "url", e.target.value)}
                                className="flex-[2]"
                              />
                              <button
                                type="button"
                                onClick={() => removeButton(idx)}
                                className="px-3 py-2 bg-[#DA373C] hover:bg-[#A12828] transition-colors rounded text-white text-xs font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          {(currentDraft.buttons || []).length < 5 && (
                            <button
                              type="button"
                              onClick={addButton}
                              className="w-full px-3 py-2 bg-[#1b1d22] border border-white/15 rounded text-xs font-semibold text-discord-text-muted hover:bg-[#252831] transition-colors"
                            >
                              + Add Button
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#1E1F22] pb-6 mb-2">
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

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-discord-text-muted flex items-center gap-1.5">
                        <SmileIcon className="w-3.5 h-3.5 text-discord-blurple" /> Auto-Reaction Emojis (Optional)
                      </label>
                      <Input
                        value={Array.isArray(currentDraft.auto_reactions) ? currentDraft.auto_reactions.join(", ") : currentDraft.auto_reactions || ""}
                        placeholder="e.g. 🎉, 👍, 🔥 (Comma-separated emojis automatically added to published announcements)"
                        onChange={(e) => {
                          const raw = e.target.value;
                          const arr = raw.split(",").map((r) => r.trim()).filter(Boolean);
                          updateDraft("auto_reactions", arr);
                        }}
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

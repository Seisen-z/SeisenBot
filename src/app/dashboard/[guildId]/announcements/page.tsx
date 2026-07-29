"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/ui/image-uploader";
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
  RotateCwIcon,
  SendIcon,
  FileTextIcon,
  SparklesIcon,
  ImageIcon,
  SaveIcon,
  SmileIcon,
  MegaphoneIcon,
} from "lucide-react";
import { PromptModal } from "@/components/ui/prompt-modal";

const DEFAULT_CATEGORY = "General";

type AnnouncementButton = { label: string; url: string };

type AnnouncementDraft = {
  name: string;
  category: string;
  post_type: "embed" | "plain";
  title: string;
  description: string;
  content: string;
  thumbnail_url: string;
  image_url: string;
  images: string[];
  footer: string;
  channel_id: string;
  ping_role_id: string;
  buttons: AnnouncementButton[];
  auto_reactions: string[];
  last_posted_at?: string | null;
  last_message_id?: string | null;
  [key: string]: any;
};

const createEmptyDraft = (name: string = "New Announcement", category: string = DEFAULT_CATEGORY): AnnouncementDraft => ({
  name,
  category,
  post_type: "embed",
  title: "",
  description: "",
  content: "",
  thumbnail_url: "",
  image_url: "",
  images: [],
  footer: "",
  channel_id: "",
  ping_role_id: "",
  buttons: [],
  auto_reactions: [],
  last_posted_at: null,
  last_message_id: null,
});

function normalizeDraft(input: any): AnnouncementDraft {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  let auto_reactions: string[] = [];
  if (Array.isArray(source.auto_reactions)) {
    auto_reactions = source.auto_reactions.filter((r: any) => typeof r === "string" && r.trim());
  } else if (typeof source.auto_reactions === "string" && source.auto_reactions.trim()) {
    auto_reactions = source.auto_reactions.split(",").map((r: string) => r.trim()).filter(Boolean);
  }

  return {
    ...createEmptyDraft(),
    ...source,
    name: typeof source.name === "string" ? source.name : "Announcement Draft",
    category: typeof source.category === "string" ? source.category : DEFAULT_CATEGORY,
    post_type: source.post_type === "plain" ? "plain" : "embed",
    title: typeof source.title === "string" ? source.title : "",
    description: typeof source.description === "string" ? source.description : "",
    content: typeof source.content === "string" ? source.content : "",
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
    last_posted_at: source.last_posted_at ? String(source.last_posted_at) : null,
    last_message_id: source.last_message_id ? String(source.last_message_id) : null,
  };
}

function parseDrafts(drafts: Record<string, AnnouncementDraft>) {
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
  const { guildId } = use(params);
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, AnnouncementDraft>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

  const [promptState, setPromptState] = useState<{
    open: boolean;
    title: string;
    label?: string;
    defaultValue?: string;
    actionType: "new_draft" | "new_cat" | "rename_draft" | "delete_draft";
    targetKey?: string;
    targetCat?: string;
  }>({
    open: false,
    title: "",
    actionType: "new_draft",
  });

  // Load Announcements
  const loadDrafts = useCallback(async () => {
    try {
      const raw = await fetchApi(`/guilds/${guildId}/announcements`);
      const normalized: Record<string, AnnouncementDraft> = {};
      for (const [k, v] of Object.entries(raw || {})) {
        normalized[k] = normalizeDraft(v);
      }
      setDrafts(normalized);
      const keys = Object.keys(normalized);
      if (keys.length > 0) {
        setActiveKey((prev) => (prev && normalized[prev] ? prev : keys[0]));
      }
    } catch (err) {
      toast("Failed to load announcement drafts", "error");
    } finally {
      setInitialLoaded(true);
    }
  }, [guildId, toast]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Auto-Save callback
  const saveDrafts = useCallback(
    async (dataToSave: Record<string, AnnouncementDraft>) => {
      try {
        await fetchApi(`/guilds/${guildId}/announcements`, undefined, {
          method: "PUT",
          body: JSON.stringify(dataToSave),
        });
      } catch (err) {
        toast("Error auto-saving announcement configuration", "error");
      }
    },
    [guildId, toast]
  );

  useDebouncedAutoSave({
    value: drafts,
    enabled: initialLoaded,
    delay: 1200,
    onSave: saveDrafts,
    onError: () => toast("Auto-save failed", "error"),
  });

  const updateActiveDraftField = (field: string, val: any) => {
    if (!activeKey) return;
    setDrafts((prev) => {
      const current = prev[activeKey] || createEmptyDraft();
      return {
        ...prev,
        [activeKey]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  const handleManualSave = async () => {
    setSavingManual(true);
    try {
      await fetchApi(`/guilds/${guildId}/announcements`, undefined, {
        method: "PUT",
        body: JSON.stringify(drafts),
      });
      toast("Announcement drafts saved successfully!", "success");
    } catch (err: any) {
      toast(`Save failed: ${err.message || err}`, "error");
    } finally {
      setSavingManual(false);
    }
  };

  // Publish Announcement Now
  const handlePublishNow = async () => {
    if (!activeKey) return;
    const draft = drafts[activeKey];
    if (!draft || !draft.channel_id) {
      toast("Please select a target channel before publishing.", "error");
      return;
    }
    setPosting(true);
    try {
      const announcementPayload = {
        ...draft,
        name: activeKey,
        ping_role_id: draft.ping_role_id || null,
        auto_reactions: draft.auto_reactions || [],
      };

      const result = await fetchApi("/trigger/announcement", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: announcementPayload,
        }),
      });
      toast("Announcement published successfully!", "success");
      if (result?.message_id || result?.last_posted_at) {
        setDrafts((prev) => ({
          ...prev,
          [activeKey]: {
            ...prev[activeKey],
            last_message_id: result.message_id || prev[activeKey].last_message_id,
            last_posted_at: result.last_posted_at || new Date().toISOString(),
          },
        }));
      }
    } catch (err: any) {
      toast(`Error publishing announcement: ${err.message}`, "error");
    } finally {
      setPosting(false);
    }
  };

  // Modal actions
  const handlePromptConfirm = async (inputVal: string) => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (promptState.actionType === "new_draft") {
      const cat = promptState.targetCat || DEFAULT_CATEGORY;
      const key = `${cat}/${trimmed}`;
      if (drafts[key]) {
        toast("A draft with this name already exists in this category.", "error");
        return;
      }
      const newDraft = createEmptyDraft(trimmed, cat);
      const nextDrafts = { ...drafts, [key]: newDraft };
      setDrafts(nextDrafts);
      setActiveKey(key);
      await saveDrafts(nextDrafts);
      toast(`Created draft "${trimmed}"`, "success");
    } else if (promptState.actionType === "new_cat") {
      const key = `${trimmed}/Welcome Announcement`;
      if (drafts[key]) {
        toast("Category already exists.", "error");
        return;
      }
      const newDraft = createEmptyDraft("Welcome Announcement", trimmed);
      const nextDrafts = { ...drafts, [key]: newDraft };
      setDrafts(nextDrafts);
      setActiveKey(key);
      await saveDrafts(nextDrafts);
      toast(`Created category "${trimmed}"`, "success");
    } else if (promptState.actionType === "rename_draft" && promptState.targetKey) {
      const oldKey = promptState.targetKey;
      const cat = oldKey.split("/")[0] || DEFAULT_CATEGORY;
      const newKey = `${cat}/${trimmed}`;

      if (drafts[newKey] && newKey !== oldKey) {
        toast("A draft with this name already exists.", "error");
        return;
      }

      try {
        await fetchApi(`/guilds/${guildId}/announcements/${encodeURIComponent(oldKey)}/rename`, undefined, {
          method: "POST",
          body: JSON.stringify({ new_name: newKey }),
        });
        const nextDrafts = { ...drafts };
        const row = nextDrafts[oldKey];
        delete nextDrafts[oldKey];
        row.name = trimmed;
        nextDrafts[newKey] = row;
        setDrafts(nextDrafts);
        if (activeKey === oldKey) setActiveKey(newKey);
        toast(`Renamed to "${trimmed}"`, "success");
      } catch (err) {
        toast("Error renaming draft", "error");
      }
    } else if (promptState.actionType === "delete_draft" && promptState.targetKey) {
      const keyToDelete = promptState.targetKey;
      try {
        await fetchApi(`/guilds/${guildId}/announcements/${encodeURIComponent(keyToDelete)}`, undefined, {
          method: "DELETE",
        });
        const nextDrafts = { ...drafts };
        delete nextDrafts[keyToDelete];
        setDrafts(nextDrafts);
        const keys = Object.keys(nextDrafts);
        if (activeKey === keyToDelete) {
          setActiveKey(keys.length > 0 ? keys[0] : null);
        }
        toast("Announcement draft deleted", "success");
      } catch (err) {
        toast("Error deleting draft", "error");
      }
    }
    setPromptState((prev) => ({ ...prev, open: false }));
  };

  const categories = parseDrafts(drafts);
  const activeDraft = activeKey ? drafts[activeKey] : null;

  const getDraftStatusText = (draft: AnnouncementDraft) => {
    if (!draft.channel_id) return { label: "Needs Channel", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
    if (draft.last_posted_at) return { label: "Published", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    return { label: "Ready to Publish", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHero
        title="Announcement Studio"
        subtitle="Design rich announcement embeds, configure target channels, set auto-reaction emojis, and publish to Discord."
        icon={MegaphoneIcon}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Navigation: Categories & Announcement Drafts */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Announcement Categories</h3>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-blue-400 hover:bg-blue-500/10"
                  onClick={() =>
                    setPromptState({
                      open: true,
                      title: "Create Category",
                      label: "Category Name",
                      actionType: "new_cat",
                    })
                  }
                >
                  <PlusIcon className="mr-1 h-3.5 w-3.5" /> Category
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {Object.keys(categories).length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">
                  No announcement drafts configured. Click below to add your first draft.
                </div>
              )}

              {Object.entries(categories).map(([categoryName, draftKeys]) => {
                const isCollapsed = collapsedCats[categoryName];
                return (
                  <div key={categoryName} className="rounded-lg border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center justify-between px-3 py-2">
                      <button
                        onClick={() =>
                          setCollapsedCats((prev) => ({ ...prev, [categoryName]: !prev[categoryName] }))
                        }
                        className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-slate-300 transition hover:text-white"
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="h-3.5 w-3.5 text-slate-500" />
                        ) : (
                          <ChevronDownIcon className="h-3.5 w-3.5 text-slate-500" />
                        )}
                        <FolderIcon className="h-3.5 w-3.5 text-blue-400" />
                        <span className="truncate">{categoryName}</span>
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {draftKeys.length}
                        </span>
                      </button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                        title="Add draft to category"
                        onClick={() =>
                          setPromptState({
                            open: true,
                            title: `Add Draft to ${categoryName}`,
                            label: "Draft Title",
                            targetCat: categoryName,
                            actionType: "new_draft",
                          })
                        }
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {!isCollapsed && (
                      <div className="space-y-1 p-1.5 pt-0">
                        {draftKeys.map((key) => {
                          const draft = drafts[key];
                          const isActive = activeKey === key;
                          const name = key.split("/")[1] || key;
                          return (
                            <div
                              key={key}
                              className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition cursor-pointer ${
                                isActive
                                  ? "bg-blue-600/20 font-medium text-blue-400 border border-blue-500/30"
                                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                              }`}
                              onClick={() => setActiveKey(key)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    draft?.channel_id ? "bg-emerald-400" : "bg-slate-600"
                                  }`}
                                />
                                <span className="truncate">{name}</span>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  className="p-1 text-slate-400 hover:text-white"
                                  title="Rename"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPromptState({
                                      open: true,
                                      title: "Rename Draft",
                                      label: "New Name",
                                      defaultValue: name,
                                      targetKey: key,
                                      actionType: "rename_draft",
                                    });
                                  }}
                                >
                                  <EditIcon className="h-3 w-3" />
                                </button>
                                <button
                                  className="p-1 text-slate-400 hover:text-rose-400"
                                  title="Delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPromptState({
                                      open: true,
                                      title: "Delete Draft",
                                      label: `Type "${name}" to confirm deletion:`,
                                      defaultValue: name,
                                      targetKey: key,
                                      actionType: "delete_draft",
                                    });
                                  }}
                                >
                                  <Trash2Icon className="h-3 w-3" />
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

              <Button
                variant="outline"
                className="w-full justify-center border-dashed border-white/20 py-2 text-xs text-slate-400 hover:border-blue-500 hover:text-blue-400"
                onClick={() =>
                  setPromptState({
                    open: true,
                    title: "Create Announcement Draft",
                    label: "Draft Title",
                    targetCat: DEFAULT_CATEGORY,
                    actionType: "new_draft",
                  })
                }
              >
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add New Draft
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel: Announcement Settings & Editor */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {!activeDraft ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/40 text-center backdrop-blur-md">
              <MegaphoneIcon className="mb-3 h-10 w-10 text-slate-600" />
              <h3 className="text-base font-medium text-slate-300">No Draft Selected</h3>
              <p className="mt-1 text-xs text-slate-500">Select an existing draft from the sidebar or create a new one.</p>
            </div>
          ) : (
            <>
              {/* Header Status & Control Bar */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-white">{activeDraft.name}</h2>
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                        {activeDraft.category}
                      </span>
                      {(() => {
                        const status = getDraftStatusText(activeDraft);
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.color}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {status.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Configure target channel, ping roles, auto-reaction emojis, and rich announcement content.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
                      disabled={savingManual}
                      onClick={handleManualSave}
                    >
                      {savingManual ? (
                        <>
                          <RotateCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <SaveIcon className="mr-1.5 h-3.5 w-3.5" /> Save Draft
                        </>
                      )}
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      className="bg-blue-600 text-white hover:bg-blue-500 font-semibold"
                      disabled={posting || !activeDraft.channel_id}
                      onClick={handlePublishNow}
                    >
                      {posting ? (
                        <>
                          <RotateCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Publishing...
                        </>
                      ) : (
                        <>
                          <SendIcon className="mr-1.5 h-3.5 w-3.5" /> Publish Announcement
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Target Channel & Mention Role Configuration */}
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Target Channel <span className="text-rose-400">*</span>
                    </label>
                    <ChannelSelect
                      guildId={guildId}
                      value={activeDraft.channel_id}
                      onChange={(val) => updateActiveDraftField("channel_id", val)}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Ping Role (Optional)
                    </label>
                    <RoleSelect
                      guildId={guildId}
                      value={activeDraft.ping_role_id}
                      onChange={(val) => updateActiveDraftField("ping_role_id", val)}
                    />
                  </div>
                </div>

                {/* Auto-Reaction Emojis Configuration */}
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <SmileIcon className="h-4 w-4 text-blue-400" /> Auto-Reaction Emojis (Optional)
                  </label>
                  <Input
                    className="bg-black/40 text-xs text-white placeholder:text-slate-500"
                    placeholder="e.g. 🎉, 👍, 🔥 (Comma-separated emojis automatically reacted to published message)"
                    value={
                      Array.isArray(activeDraft.auto_reactions)
                        ? activeDraft.auto_reactions.join(", ")
                        : activeDraft.auto_reactions || ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      const arr = raw.split(",").map((r) => r.trim()).filter(Boolean);
                      updateActiveDraftField("auto_reactions", arr);
                    }}
                  />
                  <p className="text-[11px] text-slate-500">
                    The bot will automatically add these reaction options to the announcement message once published.
                  </p>
                </div>

                {/* Execution Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 border-t border-white/5 pt-3">
                  <div>
                    <span className="text-slate-500">Last Published:</span>{" "}
                    {activeDraft.last_posted_at ? (
                      <span className="text-slate-300 font-medium">
                        {new Date(activeDraft.last_posted_at).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Never</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Last Message ID:</span>{" "}
                    {activeDraft.last_message_id ? (
                      <span className="text-slate-300 font-mono">{activeDraft.last_message_id}</span>
                    ) : (
                      <span className="text-slate-500 italic">N/A</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Format Mode Selector & Content Editor */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Message Content & Format</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Choose whether to send your announcement as plain text or as a rich Discord embed card.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 p-1">
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        activeDraft.post_type === "plain"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                      onClick={() => updateActiveDraftField("post_type", "plain")}
                    >
                      <FileTextIcon className="h-3.5 w-3.5" /> Plain Text
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        activeDraft.post_type === "embed"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                      onClick={() => updateActiveDraftField("post_type", "embed")}
                    >
                      <SparklesIcon className="h-3.5 w-3.5" /> Rich Embed Card
                    </button>
                  </div>
                </div>

                {activeDraft.post_type === "plain" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                        Plain Text Announcement Body <span className="text-rose-400">*</span>
                      </label>
                      <Textarea
                        rows={14}
                        placeholder="Type your plain text announcement message here... (Supports multiline formatting, custom emojis, URLs, and role mentions)"
                        className="bg-black/40 text-xs text-white placeholder:text-slate-500 font-mono min-h-[260px] resize-y"
                        value={activeDraft.content || ""}
                        onChange={(e) => updateActiveDraftField("content", e.target.value)}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        In Plain Text mode, your announcement is sent directly without any surrounding Discord embed card box.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-3">
                      <ImageUploader
                        onApplyImage={(url) => updateActiveDraftField("image_url", url)}
                        onAddMultiImage={(url) => updateActiveDraftField("images", [...(activeDraft.images || []), url])}
                      />
                    </div>

                    {(activeDraft.image_url || (activeDraft.images && activeDraft.images.length > 0)) && (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-blue-400" /> Attached Image URLs
                        </label>
                        {activeDraft.image_url && (
                          <div className="flex items-center justify-between gap-2 rounded bg-white/5 p-2 text-xs text-slate-300">
                            <span className="truncate text-slate-400 font-mono text-[11px]">Main Image: {activeDraft.image_url}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-[11px]"
                              onClick={() => updateActiveDraftField("image_url", "")}
                            >
                              Remove Main
                            </Button>
                          </div>
                        )}
                        {(activeDraft.images || []).map((imgUrl, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 rounded bg-white/5 p-2 text-xs text-slate-300">
                            <span className="truncate text-slate-400 font-mono text-[11px]">Image #{idx + 1}: {imgUrl}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-[11px]"
                              onClick={() => {
                                const nextImgs = [...(activeDraft.images || [])];
                                nextImgs.splice(idx, 1);
                                updateActiveDraftField("images", nextImgs);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <AdvancedEmbedEditor
                    config={{
                      content: activeDraft.content,
                      title: activeDraft.title,
                      description: activeDraft.description,
                      thumbnail_url: activeDraft.thumbnail_url,
                      image_url: activeDraft.image_url,
                      images: activeDraft.images,
                      footer: activeDraft.footer,
                    }}
                    onChange={(k, val) => updateActiveDraftField(k, val)}
                    bottomChildren={
                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <div className="flex flex-col gap-3">
                          <label className="text-xs font-semibold text-slate-300">Link Buttons (Up to 5 Buttons)</label>
                          {(activeDraft.buttons || []).map((btn, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <Input
                                placeholder="Button Label"
                                value={btn.label || ""}
                                onChange={(e) => {
                                  const nextButtons = [...(activeDraft.buttons || [])];
                                  nextButtons[idx] = { ...nextButtons[idx], label: e.target.value };
                                  updateActiveDraftField("buttons", nextButtons);
                                }}
                                className="flex-1 bg-black/40 text-xs"
                              />
                              <Input
                                placeholder="URL (https://...)"
                                value={btn.url || ""}
                                onChange={(e) => {
                                  const nextButtons = [...(activeDraft.buttons || [])];
                                  nextButtons[idx] = { ...nextButtons[idx], url: e.target.value };
                                  updateActiveDraftField("buttons", nextButtons);
                                }}
                                className="flex-[2] bg-black/40 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                onClick={() => {
                                  const nextButtons = (activeDraft.buttons || []).filter((_, i) => i !== idx);
                                  updateActiveDraftField("buttons", nextButtons);
                                }}
                              >
                                <Trash2Icon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          {(activeDraft.buttons || []).length < 5 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-fit border-dashed border-white/20 text-xs text-slate-300 hover:border-blue-500 hover:text-blue-400"
                              onClick={() => {
                                const nextButtons = [...(activeDraft.buttons || []), { label: "Learn More", url: "https://" }];
                                updateActiveDraftField("buttons", nextButtons);
                              }}
                            >
                              <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add Link Button
                            </Button>
                          )}
                        </div>

                        <div className="pt-2">
                          <ImageUploader
                            onApplyImage={(url) => updateActiveDraftField("image_url", url)}
                            onAddMultiImage={(url) => updateActiveDraftField("images", [...(activeDraft.images || []), url])}
                          />
                        </div>
                      </div>
                    }
                  />
                )}

                {/* Bottom Delete Control */}
                <div className="flex justify-end pt-3 border-t border-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-semibold"
                    onClick={() =>
                      setPromptState({
                        open: true,
                        title: "Delete Announcement Draft",
                        label: `Type "${activeDraft.name}" to confirm deletion:`,
                        defaultValue: activeDraft.name,
                        targetKey: activeKey || undefined,
                        actionType: "delete_draft",
                      })
                    }
                  >
                    <Trash2Icon className="mr-1.5 h-3.5 w-3.5" /> Delete Announcement Draft
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <PromptModal
        open={promptState.open}
        title={promptState.title}
        label={promptState.label}
        defaultValue={promptState.defaultValue || ""}
        onConfirm={handlePromptConfirm}
        onCancel={() => setPromptState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, use } from "react";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { PromptModal } from "@/components/ui/prompt-modal";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  FolderIcon,
  EditIcon,
  RotateCwIcon,
  SendIcon,
  CheckCircle2Icon,
  SaveIcon,
  GlobeIcon,
  TagIcon,
  MessageSquareIcon,
} from "lucide-react";

const DEFAULT_CATEGORY = "General";
const TAGS = ["Update", "New Script", "Patch", "Maintenance", "Announcement"] as const;
type Tag = (typeof TAGS)[number];

const TAG_COLORS: Record<Tag, string> = {
  "Update":       "border-amber-500/40 bg-amber-500/10 text-amber-300",
  "New Script":   "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  "Patch":        "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  "Maintenance":  "border-purple-500/40 bg-purple-500/10 text-purple-300",
  "Announcement": "border-blue-500/40 bg-blue-500/10 text-blue-300",
};

type WebsiteUpdateDraft = {
  name: string;
  category: string;
  title: string;
  content: string;
  tag: Tag;
  image_url: string;
  post_to_discord: boolean;
  channel_id: string;
  ping_role_id: string;
  last_published_at?: string | null;
  [key: string]: any;
};

const createEmptyDraft = (name = "New Update", category = DEFAULT_CATEGORY): WebsiteUpdateDraft => ({
  name,
  category,
  title: "",
  content: "",
  tag: "Update",
  image_url: "",
  post_to_discord: false,
  channel_id: "",
  ping_role_id: "",
  last_published_at: null,
});

function normalizeDraft(key: string, input: any): WebsiteUpdateDraft {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const parts = key.split("/");
  const keyCategory = parts.length > 1 ? parts[0] : DEFAULT_CATEGORY;
  const keyName = parts.length > 1 ? parts.slice(1).join("/") : key;
  return {
    ...createEmptyDraft(keyName, keyCategory),
    ...source,
    name: typeof source.name === "string" && source.name.trim() ? source.name : keyName,
    category: typeof source.category === "string" && source.category.trim() ? source.category : keyCategory,
    title: typeof source.title === "string" ? source.title : "",
    content: typeof source.content === "string" ? source.content : "",
    tag: TAGS.includes(source.tag) ? source.tag : "Update",
    image_url: typeof source.image_url === "string" ? source.image_url : "",
    post_to_discord: Boolean(source.post_to_discord),
    channel_id: typeof source.channel_id === "string" ? source.channel_id : "",
    ping_role_id: typeof source.ping_role_id === "string" ? source.ping_role_id : "",
    last_published_at: source.last_published_at ? String(source.last_published_at) : null,
  };
}

function parseDrafts(drafts: Record<string, WebsiteUpdateDraft>) {
  const map: Record<string, string[]> = {};
  for (const key of Object.keys(drafts)) {
    const parts = key.split("/");
    const cat = parts.length > 1 ? parts[0] : DEFAULT_CATEGORY;
    if (!map[cat]) map[cat] = [];
    map[cat].push(key);
  }
  return map;
}

export default function WebsiteUpdatesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, WebsiteUpdateDraft>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [promptState, setPromptState] = useState<{
    open: boolean;
    title: string;
    label?: string;
    defaultValue?: string;
    actionType: "new_draft" | "new_cat" | "rename_draft" | "delete_draft";
    targetKey?: string;
    targetCat?: string;
  }>({ open: false, title: "", actionType: "new_draft" });

  const loadDrafts = useCallback(async () => {
    try {
      const raw = await fetchApi(`/guilds/${guildId}/website_updates`);
      const data = raw || {};
      const normalized: Record<string, WebsiteUpdateDraft> = {};
      for (const [k, v] of Object.entries(data)) {
        normalized[k] = normalizeDraft(k, v);
      }
      setDrafts(normalized);
      const keys = Object.keys(normalized);
      if (keys.length > 0) {
        setActiveKey((prev) => (prev && normalized[prev] ? prev : keys[0]));
      }
    } catch {
      toast("Failed to load website update drafts", "error");
    } finally {
      setInitialLoaded(true);
    }
  }, [guildId, toast]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const saveDrafts = useCallback(
    async (dataToSave: Record<string, WebsiteUpdateDraft>) => {
      await fetchApi(`/guilds/${guildId}/website_updates`, undefined, {
        method: "PUT",
        body: JSON.stringify(dataToSave),
      });
    },
    [guildId]
  );

  const { isSaving, lastSaved, triggerSaveNow } = useDebouncedAutoSave({
    value: drafts,
    enabled: initialLoaded,
    delay: 600,
    onSave: saveDrafts,
    onError: () => toast("Auto-save failed", "error"),
  });

  const updateField = (field: string, val: any) => {
    if (!activeKey) return;
    setDrafts((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], [field]: val },
    }));
  };

  const handlePublish = async () => {
    if (!activeKey || publishing) return;
    const draft = drafts[activeKey];
    if (!draft.title.trim() || !draft.content.trim()) {
      toast("Title and content are required.", "error");
      return;
    }
    if (draft.post_to_discord && !draft.channel_id) {
      toast("Please select a Discord channel or disable Discord posting.", "error");
      return;
    }
    setPublishing(true);
    try {
      await fetchApi("/trigger/site_update", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            title: draft.title.trim(),
            content: draft.content.trim(),
            tag: draft.tag,
            image_url: draft.image_url.trim() || null,
            post_to_discord: draft.post_to_discord,
            channel_id: draft.post_to_discord ? draft.channel_id : null,
            ping_role_id: draft.post_to_discord ? draft.ping_role_id : null,
          },
        }),
      });
      const now = new Date().toISOString();
      setDrafts((prev) => ({
        ...prev,
        [activeKey]: { ...prev[activeKey], last_published_at: now },
      }));
      toast("Update published to Seisen website" + (draft.post_to_discord ? " and Discord!" : "!"), "success");
    } catch (err: any) {
      toast(`Failed to publish: ${err.message}`, "error");
    } finally {
      setPublishing(false);
    }
  };

  const handlePromptConfirm = async (inputVal: string) => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (promptState.actionType === "new_draft") {
      const cat = promptState.targetCat || DEFAULT_CATEGORY;
      const key = `${cat}/${trimmed}`;
      if (drafts[key]) { toast("A draft with this name already exists.", "error"); return; }
      const newDraft = createEmptyDraft(trimmed, cat);
      const next = { ...drafts, [key]: newDraft };
      setDrafts(next);
      setActiveKey(key);
      await saveDrafts(next);
      toast(`Created draft "${trimmed}"`, "success");

    } else if (promptState.actionType === "new_cat") {
      const key = `${trimmed}/New Update`;
      if (drafts[key]) { toast("Category already exists.", "error"); return; }
      const newDraft = createEmptyDraft("New Update", trimmed);
      const next = { ...drafts, [key]: newDraft };
      setDrafts(next);
      setActiveKey(key);
      await saveDrafts(next);
      toast(`Created category "${trimmed}"`, "success");

    } else if (promptState.actionType === "rename_draft" && promptState.targetKey) {
      const oldKey = promptState.targetKey;
      const cat = oldKey.split("/")[0] || DEFAULT_CATEGORY;
      const newKey = `${cat}/${trimmed}`;
      if (drafts[newKey] && newKey !== oldKey) { toast("A draft with this name already exists.", "error"); return; }
      try {
        await fetchApi(`/guilds/${guildId}/website_updates/${encodeURIComponent(oldKey)}/rename`, undefined, {
          method: "POST",
          body: JSON.stringify({ new_name: newKey }),
        });
        const next = { ...drafts };
        const row = next[oldKey];
        delete next[oldKey];
        row.name = trimmed;
        next[newKey] = row;
        setDrafts(next);
        if (activeKey === oldKey) setActiveKey(newKey);
        toast(`Renamed to "${trimmed}"`, "success");
      } catch { toast("Error renaming draft", "error"); }

    } else if (promptState.actionType === "delete_draft" && promptState.targetKey) {
      const keyToDelete = promptState.targetKey;
      try {
        await fetchApi(`/guilds/${guildId}/website_updates/${encodeURIComponent(keyToDelete)}`, undefined, {
          method: "DELETE",
        });
        const next = { ...drafts };
        delete next[keyToDelete];
        setDrafts(next);
        const keys = Object.keys(next);
        if (activeKey === keyToDelete) setActiveKey(keys.length > 0 ? keys[0] : null);
        toast("Draft deleted", "success");
      } catch { toast("Error deleting draft", "error"); }
    }

    setPromptState((prev) => ({ ...prev, open: false }));
  };

  const categories = parseDrafts(drafts);
  const activeDraft = activeKey ? drafts[activeKey] : null;

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHero
        title="Website Updates"
        subtitle="Compose and publish update posts to the Seisen Premium website. Optionally cross-post to Discord at the same time."
        icon={GlobeIcon}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Categories & Drafts */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4.5 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200 bg-clip-text text-transparent">
                Update Drafts
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-amber-400 hover:bg-amber-500/10 transition-all duration-200 rounded-lg font-medium"
                onClick={() => setPromptState({ open: true, title: "Create Category", label: "Category Name", actionType: "new_cat" })}
              >
                <PlusIcon className="mr-1 h-3.5 w-3.5" /> Category
              </Button>
            </div>

            <div className="space-y-3">
              {Object.keys(categories).length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500 rounded-xl border border-white/5 bg-white/[0.01]">
                  No drafts yet. Click below to create your first one.
                </div>
              )}

              {Object.entries(categories).map(([cat, keys]) => {
                const isCollapsed = collapsedCats[cat];
                return (
                  <div key={cat} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-200 hover:border-white/20">
                    <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02]">
                      <button
                        onClick={() => setCollapsedCats((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                        className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-slate-200 transition hover:text-white"
                      >
                        {isCollapsed ? <ChevronRightIcon className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />}
                        <FolderIcon className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                        <span className="truncate">{cat}</span>
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          {keys.length}
                        </span>
                      </button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-md"
                        onClick={() => setPromptState({ open: true, title: `Add Draft to ${cat}`, label: "Draft Title", targetCat: cat, actionType: "new_draft" })}
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {!isCollapsed && (
                      <div className="space-y-1 p-1.5 pt-1">
                        {keys.map((key) => {
                          const draft = drafts[key];
                          const isActive = activeKey === key;
                          const name = key.split("/")[1] || key;
                          return (
                            <div
                              key={key}
                              className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all duration-200 cursor-pointer ${
                                isActive
                                  ? "bg-gradient-to-r from-amber-600/25 to-orange-600/15 font-semibold text-amber-300 border border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.15)] translate-x-0.5"
                                  : "text-slate-300 hover:bg-white/[0.04] hover:text-white hover:translate-x-0.5"
                              }`}
                              onClick={() => setActiveKey(key)}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {draft?.last_published_at ? (
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                  </span>
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0" />
                                )}
                                <span className="truncate">{name}</span>
                                {draft?.tag && (
                                  <span className={`hidden group-hover:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${TAG_COLORS[draft.tag as Tag] || TAG_COLORS.Update}`}>
                                    {draft.tag}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1 text-slate-400 hover:text-white transition" title="Rename"
                                  onClick={(e) => { e.stopPropagation(); setPromptState({ open: true, title: "Rename Draft", label: "New Name", defaultValue: name, targetKey: key, actionType: "rename_draft" }); }}>
                                  <EditIcon className="h-3 w-3" />
                                </button>
                                <button className="p-1 text-slate-400 hover:text-rose-400 transition" title="Delete"
                                  onClick={(e) => { e.stopPropagation(); setPromptState({ open: true, title: "Delete Draft", label: `Type "${name}" to confirm:`, defaultValue: name, targetKey: key, actionType: "delete_draft" }); }}>
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
                className="w-full justify-center border-dashed border-white/20 py-2.5 text-xs font-semibold text-slate-300 hover:border-amber-500 hover:text-amber-400 transition-all duration-200 rounded-xl"
                onClick={() => setPromptState({ open: true, title: "Create Update Draft", label: "Draft Title", targetCat: DEFAULT_CATEGORY, actionType: "new_draft" })}
              >
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add New Draft
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Editor */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {!activeDraft ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 text-center backdrop-blur-xl shadow-2xl">
              <GlobeIcon className="mb-3 h-12 w-12 text-slate-600 animate-pulse" />
              <h3 className="text-base font-semibold text-slate-300">No Draft Selected</h3>
              <p className="mt-1 text-xs text-slate-500">Select a draft from the sidebar or create a new one.</p>
            </div>
          ) : (
            <>
              {/* ── Top card: status + config (mirrors announcements layout) ── */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl shadow-2xl space-y-5 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />

                {/* Title row */}
                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-extrabold text-white tracking-tight">{activeDraft.name}</h2>
                      <span className="rounded-md bg-white/10 border border-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300">{activeDraft.category}</span>
                      {activeDraft.last_published_at ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                          <span className="h-2 w-2 rounded-full bg-amber-500" /> Ready to Publish
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Configure Discord posting, tag, and update content below.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-white/10 bg-black/40">
                      {isSaving ? (
                        <><RotateCwIcon className="h-3.5 w-3.5 text-amber-400 animate-spin" /><span className="text-amber-300 font-medium">Saving...</span></>
                      ) : lastSaved ? (
                        <><CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-300 font-medium">Auto-saved</span></>
                      ) : (
                        <><CheckCircle2Icon className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-400">Ready</span></>
                      )}
                    </div>
                    <Button variant="default" size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500 font-semibold rounded-lg cursor-pointer"
                      disabled={isSaving}
                      onClick={async () => { try { await triggerSaveNow(); toast("Saved!", "success"); } catch { toast("Save failed", "error"); } }}>
                      {isSaving ? <><RotateCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</> : <><SaveIcon className="mr-1.5 h-3.5 w-3.5" />Save Draft</>}
                    </Button>
                    <Button variant="default" size="sm"
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-amber-600/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      disabled={publishing || !activeDraft.title.trim() || !activeDraft.content.trim()}
                      onClick={handlePublish}>
                      {publishing ? <><RotateCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />Publishing...</> : <><SendIcon className="mr-1.5 h-3.5 w-3.5" />Publish Update</>}
                    </Button>
                  </div>
                </div>

                {/* Discord channel + role (always visible, like announcements) */}
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <MessageSquareIcon className="h-3.5 w-3.5 text-blue-400" />
                      Discord Channel
                      <span className="text-slate-500 font-normal">(optional)</span>
                    </label>
                    <ChannelSelect guildId={guildId} value={activeDraft.channel_id} onChange={(v) => updateField("channel_id", v)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Ping Role <span className="text-slate-500 font-normal">(optional)</span></label>
                    <RoleSelect guildId={guildId} value={activeDraft.ping_role_id} onChange={(v) => updateField("ping_role_id", v)} />
                  </div>
                </div>

                {/* Also post to Discord toggle */}
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-white">Also post to Discord</p>
                    <p className="text-[11px] text-slate-500">Send a Discord embed to the channel above when publishing.</p>
                  </div>
                  <button type="button" onClick={() => updateField("post_to_discord", !activeDraft.post_to_discord)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 cursor-pointer ${
                      activeDraft.post_to_discord ? "bg-blue-600 border-blue-500" : "bg-white/10 border-white/20"
                    }`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${activeDraft.post_to_discord ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* Metadata footer */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 border-t border-white/5 pt-3">
                  <div>
                    <span className="text-slate-500">Last Published:</span>{" "}
                    {activeDraft.last_published_at
                      ? <span className="text-slate-300 font-medium">{new Date(activeDraft.last_published_at).toLocaleString()}</span>
                      : <span className="text-slate-500 italic">Never</span>}
                  </div>
                </div>
              </div>

              {/* ── Bottom card: content editor ── */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl shadow-2xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Update Content</h3>
                    <p className="mt-0.5 text-xs text-slate-400">Set the tag, title, body, and optional banner image for the website post.</p>
                  </div>
                </div>

                {/* Tag */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <TagIcon className="h-3.5 w-3.5 text-slate-400" /> Update Tag
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TAGS.map((t) => (
                      <button key={t} type="button" onClick={() => updateField("tag", t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-150 cursor-pointer ${
                          activeDraft.tag === t ? TAG_COLORS[t] + " scale-105 shadow-md" : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/20"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Title <span className="text-rose-400">*</span></label>
                  <Input
                    placeholder="e.g. Blox Fruits script updated to patch 68"
                    value={activeDraft.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    className="bg-black/40 text-sm text-white placeholder:text-slate-500 border-white/10 focus:border-amber-500/50"
                    maxLength={120}
                  />
                  <p className="text-[11px] text-slate-600 text-right">{activeDraft.title.length}/120</p>
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Content <span className="text-rose-400">*</span></label>
                  <Textarea
                    placeholder="Describe the update, patch notes, or announcement in detail..."
                    rows={10}
                    value={activeDraft.content}
                    onChange={(e) => updateField("content", e.target.value)}
                    className="bg-black/40 text-sm text-white placeholder:text-slate-500 min-h-[200px] resize-y border-white/10 focus:border-amber-500/50"
                  />
                </div>

                {/* Banner Image */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Banner Image URL <span className="text-slate-500 font-normal">(optional)</span></label>
                  <Input
                    placeholder="https://..."
                    value={activeDraft.image_url}
                    onChange={(e) => updateField("image_url", e.target.value)}
                    className="bg-black/40 text-sm text-white placeholder:text-slate-500 border-white/10 focus:border-amber-500/50"
                  />
                </div>

                {/* Delete */}
                <div className="flex justify-end pt-3 border-t border-white/5">
                  <Button variant="ghost" size="sm"
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-semibold rounded-lg"
                    onClick={() => setPromptState({ open: true, title: "Delete Draft", label: `Type "${activeDraft.name}" to confirm:`, defaultValue: activeDraft.name, targetKey: activeKey || undefined, actionType: "delete_draft" })}>
                    <Trash2Icon className="mr-1.5 h-3.5 w-3.5" /> Delete Draft
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

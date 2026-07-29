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
  ClockIcon,
  SendIcon,
  PauseIcon,
  PlayIcon,
  FileTextIcon,
  SparklesIcon,
  ImageIcon,
  CheckCircle2Icon,
  SaveIcon,
} from "lucide-react";
import { PromptModal } from "@/components/ui/prompt-modal";

const DEFAULT_CATEGORY = "General";

type AutoPostButton = { label: string; url: string };

type AutoPostConfig = {
  name: string;
  category: string;
  channel_id: string;
  enabled: boolean;
  interval_minutes: number;
  post_type: "embed" | "plain";
  title: string;
  description: string;
  content: string;
  thumbnail_url: string;
  image_url: string;
  images: string[];
  footer: string;
  ping_role_id: string;
  buttons: AutoPostButton[];
  last_posted_at?: string | null;
  last_message_id?: string | null;
  [key: string]: any;
};

const createEmptyPost = (name: string = "New Auto-Post", category: string = DEFAULT_CATEGORY): AutoPostConfig => ({
  name,
  category,
  channel_id: "",
  enabled: true,
  interval_minutes: 60,
  post_type: "embed",
  title: "",
  description: "",
  content: "",
  thumbnail_url: "",
  image_url: "",
  images: [],
  footer: "",
  ping_role_id: "",
  buttons: [],
  last_posted_at: null,
  last_message_id: null,
});

function normalizePost(input: any): AutoPostConfig {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    ...createEmptyPost(),
    ...source,
    name: typeof source.name === "string" ? source.name : "Auto-Post",
    category: typeof source.category === "string" ? source.category : DEFAULT_CATEGORY,
    channel_id: typeof source.channel_id === "string" ? source.channel_id : "",
    enabled: typeof source.enabled === "boolean" ? source.enabled : true,
    interval_minutes: typeof source.interval_minutes === "number" && source.interval_minutes > 0 ? source.interval_minutes : 60,
    post_type: source.post_type === "plain" ? "plain" : "embed",
    title: typeof source.title === "string" ? source.title : "",
    description: typeof source.description === "string" ? source.description : "",
    content: typeof source.content === "string" ? source.content : "",
    thumbnail_url: typeof source.thumbnail_url === "string" ? source.thumbnail_url : "",
    image_url: typeof source.image_url === "string" ? source.image_url : "",
    images: Array.isArray(source.images) ? source.images.filter((i: any) => typeof i === "string") : [],
    footer: typeof source.footer === "string" ? source.footer : "",
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
    last_posted_at: source.last_posted_at ? String(source.last_posted_at) : null,
    last_message_id: source.last_message_id ? String(source.last_message_id) : null,
  };
}

function parsePosts(posts: Record<string, AutoPostConfig>) {
  const map: Record<string, string[]> = {};
  for (const key of Object.keys(posts)) {
    const parts = key.split("/");
    const cat = parts.length > 1 ? parts[0] : DEFAULT_CATEGORY;
    if (!map[cat]) map[cat] = [];
    map[cat].push(key);
  }
  return map;
}

export default function AutoPostPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [posts, setPosts] = useState<Record<string, AutoPostConfig>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [postingNow, setPostingNow] = useState(false);

  const [promptState, setPromptState] = useState<{
    open: boolean;
    title: string;
    label?: string;
    defaultValue?: string;
    actionType: "new_post" | "new_cat" | "rename_post" | "delete_post";
    targetKey?: string;
    targetCat?: string;
  }>({
    open: false,
    title: "",
    actionType: "new_post",
  });

  // Load Auto-Posts
  const loadPosts = useCallback(async () => {
    try {
      const raw = await fetchApi(`/guilds/${guildId}/auto_posts`);
      const normalized: Record<string, AutoPostConfig> = {};
      for (const [k, v] of Object.entries(raw || {})) {
        normalized[k] = normalizePost(v);
      }
      setPosts(normalized);
      const keys = Object.keys(normalized);
      if (keys.length > 0) {
        setActiveKey((prev) => (prev && normalized[prev] ? prev : keys[0]));
      }
    } catch (err) {
      toast("Failed to load auto-posts", "error");
    } finally {
      setInitialLoaded(true);
    }
  }, [guildId, toast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Auto-Save callback
  const savePosts = useCallback(
    async (dataToSave: Record<string, AutoPostConfig>) => {
      try {
        await fetchApi(`/guilds/${guildId}/auto_posts`, undefined, {
          method: "PUT",
          body: JSON.stringify(dataToSave),
        });
      } catch (err) {
        toast("Error auto-saving auto-post configuration", "error");
      }
    },
    [guildId, toast]
  );

  const { isSaving, lastSaved, triggerSaveNow } = useDebouncedAutoSave({
    value: posts,
    enabled: initialLoaded,
    delay: 600,
    onSave: savePosts,
    onError: () => toast("Auto-save failed", "error"),
  });

  const updateActivePostField = (field: string, val: any) => {
    if (!activeKey) return;
    setPosts((prev) => {
      const current = prev[activeKey] || createEmptyPost();
      return {
        ...prev,
        [activeKey]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  // Immediate Post Now
  const handlePostNow = async () => {
    if (!activeKey) return;
    const post = posts[activeKey];
    if (!post || !post.channel_id) {
      toast("Please select a target channel before posting.", "error");
      return;
    }
    setPostingNow(true);
    try {
      const result = await fetchApi(
        `/guilds/${guildId}/auto_posts/${encodeURIComponent(activeKey)}/post_now`,
        undefined,
        {
          method: "POST",
          body: JSON.stringify(post),
        }
      );
      toast("Message posted successfully!", "success");
      if (result.message_id || result.last_posted_at) {
        setPosts((prev) => ({
          ...prev,
          [activeKey]: {
            ...prev[activeKey],
            last_message_id: result.message_id || prev[activeKey].last_message_id,
            last_posted_at: result.last_posted_at || new Date().toISOString(),
          },
        }));
      }
    } catch (err: any) {
      toast(`Error posting message: ${err.message}`, "error");
    } finally {
      setPostingNow(false);
    }
  };

  // Modal actions
  const handlePromptConfirm = async (inputVal: string) => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (promptState.actionType === "new_post") {
      const cat = promptState.targetCat || DEFAULT_CATEGORY;
      const key = `${cat}/${trimmed}`;
      if (posts[key]) {
        toast("A post with this name already exists in this category.", "error");
        return;
      }
      const newPost = createEmptyPost(trimmed, cat);
      const nextPosts = { ...posts, [key]: newPost };
      setPosts(nextPosts);
      setActiveKey(key);
      await savePosts(nextPosts);
      toast(`Created auto-post "${trimmed}"`, "success");
    } else if (promptState.actionType === "new_cat") {
      const key = `${trimmed}/New Auto-Post`;
      if (posts[key]) {
        toast("Category already exists.", "error");
        return;
      }
      const newPost = createEmptyPost("New Auto-Post", trimmed);
      const nextPosts = { ...posts, [key]: newPost };
      setPosts(nextPosts);
      setActiveKey(key);
      await savePosts(nextPosts);
      toast(`Created category "${trimmed}"`, "success");
    } else if (promptState.actionType === "rename_post" && promptState.targetKey) {
      const oldKey = promptState.targetKey;
      const cat = oldKey.split("/")[0] || DEFAULT_CATEGORY;
      const newKey = `${cat}/${trimmed}`;

      if (posts[newKey] && newKey !== oldKey) {
        toast("A post with this name already exists.", "error");
        return;
      }

      try {
        await fetchApi(`/guilds/${guildId}/auto_posts/${encodeURIComponent(oldKey)}/rename`, undefined, {
          method: "POST",
          body: JSON.stringify({ new_name: newKey }),
        });
        const nextPosts = { ...posts };
        const row = nextPosts[oldKey];
        delete nextPosts[oldKey];
        row.name = trimmed;
        nextPosts[newKey] = row;
        setPosts(nextPosts);
        if (activeKey === oldKey) setActiveKey(newKey);
        toast(`Renamed to "${trimmed}"`, "success");
      } catch (err) {
        toast("Error renaming auto-post", "error");
      }
    } else if (promptState.actionType === "delete_post" && promptState.targetKey) {
      const keyToDelete = promptState.targetKey;
      try {
        await fetchApi(`/guilds/${guildId}/auto_posts/${encodeURIComponent(keyToDelete)}`, undefined, {
          method: "DELETE",
        });
        const nextPosts = { ...posts };
        delete nextPosts[keyToDelete];
        setPosts(nextPosts);
        const keys = Object.keys(nextPosts);
        if (activeKey === keyToDelete) {
          setActiveKey(keys.length > 0 ? keys[0] : null);
        }
        toast("Auto-post deleted", "success");
      } catch (err) {
        toast("Error deleting auto-post", "error");
      }
    }
    setPromptState((prev) => ({ ...prev, open: false }));
  };

  const categories = parsePosts(posts);
  const activePost = activeKey ? posts[activeKey] : null;

  const formatInterval = (minutes: number) => {
    if (minutes === 60) return "1 Hour";
    if (minutes === 600) return "10 Hours";
    if (minutes === 1440) return "24 Hours";
    if (minutes % 60 === 0) return `${minutes / 60} Hours`;
    return `${minutes} Minutes`;
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHero
        title="Auto-Post System"
        subtitle="Configure scheduled recurring messages that automatically repost and delete the previous message on set intervals."
        icon={RotateCwIcon}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Navigation: Categories & Draft Posts */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4.5 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200 bg-clip-text text-transparent">
                Post Categories
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-blue-400 hover:bg-blue-500/10 transition-all duration-200 rounded-lg font-medium"
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

            <div className="space-y-3">
              {Object.keys(categories).length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500 rounded-xl border border-white/5 bg-white/[0.01]">
                  No auto-posts configured. Click below to add your first post.
                </div>
              )}

              {Object.entries(categories).map(([categoryName, postKeys]) => {
                const isCollapsed = collapsedCats[categoryName];
                return (
                  <div
                    key={categoryName}
                    className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-200 hover:border-white/20"
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02]">
                      <button
                        onClick={() =>
                          setCollapsedCats((prev) => ({ ...prev, [categoryName]: !prev[categoryName] }))
                        }
                        className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-slate-200 transition hover:text-white"
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <FolderIcon className="h-3.5 w-3.5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="truncate">{categoryName}</span>
                        <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                          {postKeys.length}
                        </span>
                      </button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition"
                        title="Add post to category"
                        onClick={() =>
                          setPromptState({
                            open: true,
                            title: `Add Post to ${categoryName}`,
                            label: "Post Title",
                            targetCat: categoryName,
                            actionType: "new_post",
                          })
                        }
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {!isCollapsed && (
                      <div className="space-y-1 p-1.5 pt-1">
                        {postKeys.map((key) => {
                          const post = posts[key];
                          const isActive = activeKey === key;
                          const name = key.split("/")[1] || key;
                          return (
                            <div
                              key={key}
                              className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all duration-200 cursor-pointer ${
                                isActive
                                  ? "bg-gradient-to-r from-blue-600/25 to-indigo-600/15 font-semibold text-blue-300 border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.2)] transform translate-x-0.5"
                                  : "text-slate-300 hover:bg-white/[0.04] hover:text-white hover:translate-x-0.5"
                              }`}
                              onClick={() => setActiveKey(key)}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {post?.enabled && post?.channel_id ? (
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0" />
                                )}
                                <span className="truncate">{name}</span>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="p-1 text-slate-400 hover:text-white transition"
                                  title="Rename"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPromptState({
                                      open: true,
                                      title: "Rename Post",
                                      label: "New Name",
                                      defaultValue: name,
                                      targetKey: key,
                                      actionType: "rename_post",
                                    });
                                  }}
                                >
                                  <EditIcon className="h-3 w-3" />
                                </button>
                                <button
                                  className="p-1 text-slate-400 hover:text-rose-400 transition"
                                  title="Delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPromptState({
                                      open: true,
                                      title: "Delete Post",
                                      label: `Type "${name}" to confirm deletion:`,
                                      defaultValue: name,
                                      targetKey: key,
                                      actionType: "delete_post",
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
                className="w-full justify-center border-dashed border-white/20 py-2.5 text-xs font-semibold text-slate-300 hover:border-blue-500 hover:text-blue-400 transition-all duration-200 rounded-xl"
                onClick={() =>
                  setPromptState({
                    open: true,
                    title: "Create Auto-Post",
                    label: "Post Title",
                    targetCat: DEFAULT_CATEGORY,
                    actionType: "new_post",
                  })
                }
              >
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add New Auto-Post
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel: Auto-Post Settings & Editor */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {!activePost ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 text-center backdrop-blur-xl shadow-2xl">
              <RotateCwIcon className="mb-3 h-12 w-12 text-slate-600 animate-spin-slow" />
              <h3 className="text-base font-semibold text-slate-300">No Auto-Post Selected</h3>
              <p className="mt-1 text-xs text-slate-500">Select an existing post from the sidebar or create a new one.</p>
            </div>
          ) : (
            <>
              {/* Header Status & Control Bar */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl shadow-2xl space-y-5 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-extrabold text-white tracking-tight">{activePost.name}</h2>
                      <span className="rounded-md bg-white/10 border border-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                        {activePost.category}
                      </span>
                      {(() => {
                        if (!activePost.channel_id) {
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              Needs Channel
                            </span>
                          );
                        }
                        if (!activePost.enabled) {
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                              <span className="h-2 w-2 rounded-full bg-amber-500" />
                              Paused
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Active Schedule
                          </span>
                        );
                      })()}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Configure interval schedules, channel targets, and message embeds.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-white/10 bg-black/40">
                      {isSaving ? (
                        <>
                          <RotateCwIcon className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                          <span className="text-blue-300 font-medium">Saving...</span>
                        </>
                      ) : lastSaved ? (
                        <>
                          <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-300 font-medium">Auto-saved</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2Icon className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-slate-400">Ready</span>
                        </>
                      )}
                    </div>

                    <Button
                      variant="default"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500 font-semibold rounded-lg transition cursor-pointer"
                      disabled={isSaving}
                      onClick={async () => {
                        try {
                          await triggerSaveNow();
                          toast("Saved changes successfully!", "success");
                        } catch (err: any) {
                          toast(`Save failed: ${err.message || err}`, "error");
                        }
                      }}
                    >
                      {isSaving ? (
                        <>
                          <RotateCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <SaveIcon className="mr-1.5 h-3.5 w-3.5" /> Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      variant={activePost.enabled ? "outline" : "default"}
                      size="sm"
                      className={
                        activePost.enabled
                          ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
                          : "bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg transition"
                      }
                      onClick={() => updateActivePostField("enabled", !activePost.enabled)}
                    >
                      {activePost.enabled ? (
                        <>
                          <PauseIcon className="mr-1.5 h-3.5 w-3.5" /> Pause Schedule
                        </>
                      ) : (
                        <>
                          <PlayIcon className="mr-1.5 h-3.5 w-3.5" /> Enable Schedule
                        </>
                      )}
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-600/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] rounded-lg"
                      disabled={postingNow || !activePost.channel_id}
                      onClick={handlePostNow}
                    >
                      {postingNow ? (
                        <>
                          <RotateCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Posting...
                        </>
                      ) : (
                        <>
                          <SendIcon className="mr-1.5 h-3.5 w-3.5" /> Post Now & Reset Timer
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Target Channel & Interval Configuration */}
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Target Channel <span className="text-rose-400">*</span>
                    </label>
                    <ChannelSelect
                      guildId={guildId}
                      value={activePost.channel_id}
                      onChange={(val) => updateActivePostField("channel_id", val)}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Mention Role (Optional)
                    </label>
                    <RoleSelect
                      guildId={guildId}
                      value={activePost.ping_role_id}
                      onChange={(val) => updateActivePostField("ping_role_id", val)}
                    />
                  </div>
                </div>

                {/* Repost Interval Selector */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                      <ClockIcon className="h-4 w-4 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> Auto-Repost & Deletion Interval
                    </div>
                    <span className="text-xs text-blue-400 font-bold tracking-wide">
                      Current: {formatInterval(activePost.interval_minutes)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { label: "1 Hour (1h)", mins: 60 },
                      { label: "10 Hours (10h)", mins: 600 },
                      { label: "24 Hours (24h)", mins: 1440 },
                    ].map((preset) => (
                      <button
                        key={preset.mins}
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                          activePost.interval_minutes === preset.mins
                            ? "border-blue-500/80 bg-gradient-to-r from-blue-600/30 to-indigo-600/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-1 ring-blue-400/50"
                            : "border-white/10 bg-black/40 text-slate-300 hover:border-white/20 hover:bg-white/10"
                        }`}
                        onClick={() => updateActivePostField("interval_minutes", preset.mins)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-slate-400 whitespace-nowrap">Custom Interval (Minutes):</label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-28 text-xs bg-black/40 border-white/10 focus:border-blue-500"
                      value={activePost.interval_minutes || 60}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 60);
                        updateActivePostField("interval_minutes", val);
                      }}
                    />
                    <span className="text-[11px] text-slate-500">
                      (Minimum 1 minute. The bot deletes the previous post and sends a fresh message.)
                    </span>
                  </div>
                </div>

                {/* Execution State Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 border-t border-white/5 pt-3">
                  <div>
                    <span className="text-slate-500">Last Posted:</span>{" "}
                    {activePost.last_posted_at ? (
                      <span className="text-slate-300 font-medium">
                        {new Date(activePost.last_posted_at).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Never</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Last Message ID:</span>{" "}
                    {activePost.last_message_id ? (
                      <span className="text-slate-300 font-mono">{activePost.last_message_id}</span>
                    ) : (
                      <span className="text-slate-500 italic">N/A</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Format Mode Selector & Content Editor */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl shadow-2xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Message Content & Format</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Choose whether to send your auto-post as plain text or as a rich Discord embed card.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 p-1">
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activePost.post_type === "plain"
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                      onClick={() => updateActivePostField("post_type", "plain")}
                    >
                      <FileTextIcon className="h-3.5 w-3.5" /> Plain Text
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activePost.post_type === "embed"
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                      onClick={() => updateActivePostField("post_type", "embed")}
                    >
                      <SparklesIcon className="h-3.5 w-3.5" /> Rich Embed Card
                    </button>
                  </div>
                </div>

                {activePost.post_type === "plain" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                        Plain Text Message Body <span className="text-rose-400">*</span>
                      </label>
                      <Textarea
                        rows={14}
                        placeholder="Type your plain text auto-post message here... (Supports multiline formatting, custom emojis, URLs, and role mentions)"
                        className="bg-black/40 text-xs text-white placeholder:text-slate-500 font-mono min-h-[260px] resize-y border-white/10 focus:border-blue-500"
                        value={activePost.content || ""}
                        onChange={(e) => updateActivePostField("content", e.target.value)}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        In Plain Text mode, your post is sent directly without any surrounding Discord embed card box.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-3">
                      <ImageUploader
                        onApplyImage={(url) => updateActivePostField("image_url", url)}
                        onAddMultiImage={(url) => updateActivePostField("images", [...(activePost.images || []), url])}
                      />
                    </div>

                    {(activePost.image_url || (activePost.images && activePost.images.length > 0)) && (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3.5 space-y-2">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-blue-400" /> Attached Image URLs
                        </label>
                        {activePost.image_url && (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-slate-300">
                            <span className="truncate text-slate-400 font-mono text-[11px]">Main Image: {activePost.image_url}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-[11px]"
                              onClick={() => updateActivePostField("image_url", "")}
                            >
                              Remove Main
                            </Button>
                          </div>
                        )}
                        {(activePost.images || []).map((imgUrl, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-slate-300">
                            <span className="truncate text-slate-400 font-mono text-[11px]">Image #{idx + 1}: {imgUrl}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-[11px]"
                              onClick={() => {
                                const nextImgs = [...(activePost.images || [])];
                                nextImgs.splice(idx, 1);
                                updateActivePostField("images", nextImgs);
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
                      content: activePost.content,
                      title: activePost.title,
                      description: activePost.description,
                      thumbnail_url: activePost.thumbnail_url,
                      image_url: activePost.image_url,
                      images: activePost.images,
                      footer: activePost.footer,
                    }}
                    onChange={(k, val) => updateActivePostField(k, val)}
                    bottomChildren={
                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <div className="flex flex-col gap-3">
                          <label className="text-xs font-semibold text-slate-300">Link Buttons (Up to 5 Buttons)</label>
                          {(activePost.buttons || []).map((btn, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <Input
                                placeholder="Button Label"
                                value={btn.label || ""}
                                onChange={(e) => {
                                  const nextButtons = [...(activePost.buttons || [])];
                                  nextButtons[idx] = { ...nextButtons[idx], label: e.target.value };
                                  updateActivePostField("buttons", nextButtons);
                                }}
                                className="flex-1 bg-black/40 text-xs border-white/10"
                              />
                              <Input
                                placeholder="URL (https://...)"
                                value={btn.url || ""}
                                onChange={(e) => {
                                  const nextButtons = [...(activePost.buttons || [])];
                                  nextButtons[idx] = { ...nextButtons[idx], url: e.target.value };
                                  updateActivePostField("buttons", nextButtons);
                                }}
                                className="flex-[2] bg-black/40 text-xs border-white/10"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                onClick={() => {
                                  const nextButtons = (activePost.buttons || []).filter((_, i) => i !== idx);
                                  updateActivePostField("buttons", nextButtons);
                                }}
                              >
                                <Trash2Icon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          {(activePost.buttons || []).length < 5 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-fit border-dashed border-white/20 text-xs text-slate-300 hover:border-blue-500 hover:text-blue-400 rounded-lg"
                              onClick={() => {
                                const nextButtons = [...(activePost.buttons || []), { label: "Learn More", url: "https://" }];
                                updateActivePostField("buttons", nextButtons);
                              }}
                            >
                              <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add Link Button
                            </Button>
                          )}
                        </div>

                        <div className="pt-2">
                          <ImageUploader
                            onApplyImage={(url) => updateActivePostField("image_url", url)}
                            onAddMultiImage={(url) => updateActivePostField("images", [...(activePost.images || []), url])}
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
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-semibold rounded-lg"
                    onClick={() =>
                      setPromptState({
                        open: true,
                        title: "Delete Auto-Post",
                        label: `Type "${activePost.name}" to confirm deletion:`,
                        defaultValue: activePost.name,
                        targetKey: activeKey || undefined,
                        actionType: "delete_post",
                      })
                    }
                  >
                    <Trash2Icon className="mr-1.5 h-3.5 w-3.5" /> Delete Auto-Post
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

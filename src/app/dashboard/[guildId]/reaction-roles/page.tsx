"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { Input } from "@/components/ui/input";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, Trash2Icon, FolderIcon, Send, ListIcon, Sparkles } from "lucide-react";
import { PromptModal } from "@/components/ui/prompt-modal";

// Draft key format: "Category/DraftName" — uncategorized uses "General/DraftName"
const DEFAULT_CATEGORY = "General";

interface SelectOption {
  label: string;
  value: string; // role id
  description: string;
  emoji?: string;
}

interface SelectMenuDraft {
  title: string;
  description: string;
  content?: string;
  color?: string | number;
  thumbnail_url?: string;
  footer?: string;
  channel_id?: string;
  placeholder: string;
  min_values: number;
  max_values: number;
  options: SelectOption[];
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

export default function SelectMenuRolesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, SelectMenuDraft>>({});
  const [activeDraftKey, setActiveDraftKey] = useState<string>("");
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<{ title: string; label: string; action: 'category' | 'draft' | 'rename'; cat?: string; oldKey?: string }>({
    title: "", label: "", action: "category"
  });

  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionDescription, setNewOptionDescription] = useState("");
  const [newOptionEmoji, setNewOptionEmoji] = useState("");
  const [newRoleId, setNewRoleId] = useState("");

  // Auto-save drafts after changes (with debounce)
  useEffect(() => {
    if (!initialLoadComplete) return; // Don't save until initial load is complete
    if (Object.keys(drafts).length === 0) return; // Don't save empty state
    
    const timeoutId = setTimeout(() => {
      // Auto-save after 2 seconds of no changes
      setSaving(true);
      fetchApi(`/guilds/${guildId}/select_menu_roles`, undefined, {
        method: "PUT",
        body: JSON.stringify(drafts),
      })
        .then(() => {
          setLastSaved(new Date());
        })
        .catch((err) => {
          console.error("Auto-save failed:", err);
          toast("Auto-save failed", "error");
        })
        .finally(() => {
          setSaving(false);
        });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [drafts, guildId, toast, initialLoadComplete]);

  const DEFAULT_DRAFT: SelectMenuDraft = {
    title: "📣 Self-Assignable Roles",
    description: "Welcome! Use the dropdown menu below to pick your favorite roles and stay up to date with the server!",
    placeholder: "Choose roles...",
    min_values: 1,
    max_values: 5,
    options: [],
    color: "#5865F2",
    thumbnail_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Discord_logo_purple.svg/1200px-Discord_logo_purple.svg.png",
    footer: "Seisen Role Management"
  };

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/select_menu_roles`)
      .then((data) => {
        const d = data || {};
        setDrafts(d);
        const keys = Object.keys(d);
        if (keys.length > 0) setActiveDraftKey(keys[0]);
        setInitialLoadComplete(true);
      })
      .catch((err) => {
        console.error("Load error:", err);
        toast("Failed to load select menu roles", "error");
        setInitialLoadComplete(true);
      });
  }, [guildId, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/select_menu_roles`, undefined, {
        method: "PUT",
        body: JSON.stringify(drafts),
      });
      setLastSaved(new Date());
      toast("Drafts Saved Successfully!");
    } catch (e: any) {
        toast(e?.message || "Failed to save.", "error");
      } finally {
      setSaving(false);
    }
  };

  const currentDraft = drafts[activeDraftKey] || { ...DEFAULT_DRAFT };

  const updateDraft = (key: string, val: any) => {
    setDrafts(prev => {
      // Ensure the draft exists in state before updating
      const existingDraft = prev[activeDraftKey] || { ...DEFAULT_DRAFT };
      return {
        ...prev,
        [activeDraftKey]: { ...existingDraft, [key]: val }
      };
    });
  };

  const handlePostNow = async () => {
    if (!currentDraft.channel_id) {
      toast("Select a target channel first.", "error");
      return;
    }
    if (currentDraft.options.length === 0) {
      toast("Add at least one role option.", "error");
      return;
    }

    // Validate Discord requirements for select menu options
    for (const option of currentDraft.options) {
      if (!option.label || option.label.length < 1 || option.label.length > 100) {
        toast("All option labels must be between 1-100 characters.", "error");
        return;
      }
      if (option.description && option.description.length > 100) {
        toast("All option descriptions must be 100 characters or less.", "error");
        return;
      }
    }

    setPosting(true);
    try {
      // Format description as array of lines (split by newlines)
      const descriptionLines = currentDraft.description 
        ? currentDraft.description.split('\n') 
        : [];

      const discordPayload = {
        content: currentDraft.content || null,
        embeds: [{
          title: currentDraft.title,
          description: descriptionLines,
          color: typeof currentDraft.color === 'string' && currentDraft.color.startsWith('#') 
            ? parseInt(currentDraft.color.replace('#', ''), 16) 
            : parseInt(String(currentDraft.color || "5814783")),
          fields: null
        }],
        components: [{
          type: 1,
          components: [{
            type: 3,
            custom_id: "role_select",
            placeholder: currentDraft.placeholder,
            min_values: Math.min(currentDraft.min_values, currentDraft.options.length) || 1,
            max_values: Math.min(currentDraft.max_values, currentDraft.options.length) || 1,
            options: currentDraft.options.map(opt => ({
              label: opt.label,
              value: opt.value,
              description: opt.description,
              default: false
            }))
          }]
        }]
      };

      await fetchApi('/trigger/create_select_menu_role', undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_id: currentDraft.channel_id,
            message_data: discordPayload
          }
        })
      });
      toast("Select Menu Sent Successfully!");
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

  const handlePromptConfirm = (value: string) => {
    if (promptConfig.action === "category") {
      const key = `${value}/${value} Draft 1`;
      if (!drafts[key]) {
        setDrafts(prev => ({ ...prev, [key]: { ...DEFAULT_DRAFT } }));
        setActiveDraftKey(key);
      }
    } else if (promptConfig.action === "draft" && promptConfig.cat) {
      const key = `${promptConfig.cat}/${value}`;
      if (drafts[key]) {
        toast("A draft with that name already exists.", "error");
      } else {
        setDrafts(prev => ({ ...prev, [key]: { ...DEFAULT_DRAFT } }));
        setActiveDraftKey(key);
      }
    } else if (promptConfig.action === "rename" && promptConfig.oldKey) {
      const oldKey = promptConfig.oldKey;
      const cat = oldKey.split("/")[0];
      const newKey = `${cat}/${value}`;
      if (drafts[newKey]) {
        toast("A draft with that name already exists.", "error");
      } else {
        const oldSafe = encodeURIComponent(oldKey);
        fetchApi(`/guilds/${guildId}/select_menu_roles/${oldSafe}/rename`, undefined, {
          method: "POST",
          body: JSON.stringify({ new_name: newKey })
        })
        .then(() => {
          const updated = { ...drafts };
          updated[newKey] = updated[oldKey];
          delete updated[oldKey];
          setDrafts(updated);
          setActiveDraftKey(newKey);
          toast("Draft renamed!");
        })
        .catch((err: any) => {
          toast("Rename failed: " + err.message, "error");
        });
      }
    }
    setPromptOpen(false);
  };

  const deleteDraft = (key: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    
    const keySafe = encodeURIComponent(key);
    fetchApi(`/guilds/${guildId}/select_menu_roles/${keySafe}`, undefined, {
      method: "DELETE"
    })
    .then(() => {
      const updated = { ...drafts };
      delete updated[key];
      setDrafts(updated);
      setActiveDraftKey(Object.keys(updated)[0] || "");
      toast("Draft deleted.");
    })
    .catch((err: any) => {
      toast("Delete failed " + err.message, "error");
    });
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categorized = parseDrafts(drafts);

  const draftLabel = (key: string) => {
    const parts = key.split("/");
    return parts.length > 1 ? parts.slice(1).join("/") : key;
  };

  const renameDraft = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPromptConfig({ 
        title: "Rename Draft", 
        label: "New Draft Name", 
        action: "rename", 
        oldKey: key 
    });
    setPromptOpen(true);
  };

  const addOption = () => {
    if (!newOptionLabel.trim() || !newRoleId) {
      toast("Please enter a label and select a role", "error");
      return;
    }

    // Discord validation rules
    const label = newOptionLabel.trim();
    const description = newOptionDescription.trim() || `Get the ${newOptionLabel} role`;
    
    if (label.length < 1 || label.length > 100) {
      toast("Option label must be between 1-100 characters", "error");
      return;
    }
    
    if (description.length > 100) {
      toast("Option description must be 100 characters or less", "error");
      return;
    }

    const newOption: SelectOption = {
      label: label,
      value: newRoleId,
      description: description,
      emoji: newOptionEmoji.trim() || undefined,
    };

    updateDraft("options", [...currentDraft.options, newOption]);
    setNewOptionLabel("");
    setNewOptionDescription("");
    setNewOptionEmoji("");
    setNewRoleId("");
  };

  const removeOption = (index: number) => {
    updateDraft("options", currentDraft.options.filter((_, i) => i !== index));
  };

  // Build full message object for preview
  const previewMessage = {
    content: currentDraft.content || null,
    embeds: [{
      title: currentDraft.title,
      description: currentDraft.description ? currentDraft.description.split('\n') : [],
      color: typeof currentDraft.color === 'string' && currentDraft.color.startsWith('#') 
        ? parseInt(currentDraft.color.replace('#', ''), 16) 
        : parseInt(String(currentDraft.color || "5814783")),
      fields: null
    }],
    components: [{
      type: 1,
      components: [{
        type: 3,
        custom_id: "role_select",
        placeholder: currentDraft.placeholder,
        min_values: Math.min(currentDraft.min_values, currentDraft.options.length) || 1,
        max_values: Math.min(currentDraft.max_values, currentDraft.options.length) || 1,
        options: currentDraft.options.map(o => ({
            label: o.label,
            value: o.value,
            description: o.description,
            default: false
        }))
      }]
    }]
  };

  const totalDrafts = Object.keys(drafts).length;
  const totalCategories = Object.keys(categorized).length;
  const optionCount = currentDraft.options?.length || 0;
  const isPostReady = Boolean(currentDraft.channel_id) && optionCount > 0;

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={Sparkles}
        title="Select Menu Roles"
        subtitle="Design interactive dropdown role menus with categories, reusable drafts, and one-click posting."
        stats={[
          { label: "Categories", value: totalCategories },
          { label: "Draft Menus", value: totalDrafts },
          { label: "Options In Draft", value: optionCount },
          { label: "Post Ready", value: isPostReady ? "Yes" : "No" },
        ]}
        actions={
          <div className="flex gap-3 items-center">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Now"}
            </Button>
            <Button variant="discord" onClick={handlePostNow} disabled={posting}>
              {posting ? "Posting..." : "Send to Channel"}
            </Button>
          </div>
        }
      />

      <div className="flex gap-6 h-full min-h-[700px]">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 h-fit">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Saved Menus</span>
            <button
              title="New Category"
              onClick={addCategory}
              className="flex items-center gap-1 text-xs text-discord-text-muted hover:text-white bg-[#1E1F22] hover:bg-discord-blurple rounded-md px-2 py-1 transition"
            >
              <PlusIcon className="w-3 h-3" /> Category
            </button>
          </div>

          {Object.keys(categorized).length === 0 && (
            <p className="text-xs text-discord-text-muted px-2 py-3 text-center opacity-60">No menus saved yet.</p>
          )}

          {Object.entries(categorized).map(([cat, keys]) => (
            <div key={cat} className="mb-1">
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
                  onClick={() => addDraftToCategory(cat)}
                  className="opacity-0 group-hover:opacity-100 text-discord-text-muted hover:text-white bg-[#313338] hover:bg-discord-blurple rounded p-0.5 transition"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>

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
                        onClick={(e) => renameDraft(key, e)}
                        className="opacity-0 group-hover/item:opacity-100 ml-1 text-discord-text-muted hover:text-white shrink-0 p-0.5 rounded"
                        title="Rename draft"
                      >
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={() => deleteDraft(key)}
                        className="opacity-0 group-hover/item:opacity-100 ml-1 text-red-400 hover:text-red-300 shrink-0 p-0.5 rounded"
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-0 relative overflow-hidden flex flex-col">
            {activeDraftKey ? (
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-[#1E1F22] flex justify-between items-center bg-[#242529]">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-discord-blurple" />
                            Editing: {draftLabel(activeDraftKey)}
                        </h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <AdvancedEmbedEditor
                    config={{...currentDraft, components: previewMessage.components}}
                    onChange={updateDraft}
                    bottomChildren={
                        <div className="mt-8 pt-8 border-t border-[#1E1F22]">
                            <h3 className="mb-4 text-sm font-bold text-discord-text-muted uppercase tracking-wide flex items-center gap-2">
                                <ListIcon className="w-4 h-4" /> Dropdown Configuration
                            </h3>
                            
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div>
                                <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Menu Placeholder</label>
                                <Input
                                    value={currentDraft.placeholder}
                                    onChange={(e) => updateDraft("placeholder", e.target.value)}
                                    placeholder="Select roles..."
                                />
                                </div>
                                <div>
                                <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Min Selection</label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="25"
                                    value={currentDraft.min_values}
                                    onChange={(e) => updateDraft("min_values", parseInt(e.target.value) || 1)}
                                />
                                </div>
                                <div>
                                <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Max Selection</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="25"
                                    value={currentDraft.max_values}
                                    onChange={(e) => updateDraft("max_values", parseInt(e.target.value) || 1)}
                                />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-discord-text-muted uppercase">Role Options ({currentDraft.options.length}/25)</label>
                                </div>

                                <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {currentDraft.options.map((option, index) => (
                                    <div key={index} className="rounded-lg border border-[#1E1F22] bg-[#313338] p-3 flex items-center gap-3 group/opt relative">
                                        <div className="grid grid-cols-12 gap-3 flex-1">
                                            <div className="col-span-3">
                                                <label className="text-[10px] text-discord-text-muted mb-1 block">Label</label>
                                                <Input 
                                                    value={option.label}
                                                    onChange={(e) => {
                                                        const newOpts = [...currentDraft.options];
                                                        newOpts[index].label = e.target.value;
                                                        updateDraft("options", newOpts);
                                                    }}
                                                    className="h-8 text-[13px]"
                                                />
                                            </div>
                                            <div className="col-span-6">
                                                <label className="text-[10px] text-discord-text-muted mb-1 block">Description</label>
                                                <Input 
                                                    value={option.description}
                                                    onChange={(e) => {
                                                        const newOpts = [...currentDraft.options];
                                                        newOpts[index].description = e.target.value;
                                                        updateDraft("options", newOpts);
                                                    }}
                                                    className="h-8 text-[13px]"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-[10px] text-discord-text-muted mb-1 block text-center">Emoji</label>
                                                <Input 
                                                    value={option.emoji || ""}
                                                    onChange={(e) => {
                                                        const newOpts = [...currentDraft.options];
                                                        newOpts[index].emoji = e.target.value;
                                                        updateDraft("options", newOpts);
                                                    }}
                                                    className="h-8 text-center px-1"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] text-discord-text-muted mb-1 block">Role ID</label>
                                                <div className="h-8 flex items-center rounded bg-[#1E1F22] px-2 text-[11px] text-discord-text-muted truncate">
                                                    {option.value}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeOption(index)} 
                                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition"
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                </div>

                                {currentDraft.options.length < 25 && (
                                    <div className="rounded-lg border border-dashed border-discord-blurple/30 bg-discord-blurple/5 p-4">
                                        <h4 className="text-[11px] font-bold text-discord-blurple uppercase mb-3 flex items-center gap-1.5">
                                            <PlusIcon className="w-3 h-3" /> Add Role Option
                                        </h4>
                                        <div className="grid grid-cols-12 gap-3 mb-3">
                                            <div className="col-span-3">
                                                <Input value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)} placeholder="Option Label" className="h-9" />
                                            </div>
                                            <div className="col-span-5">
                                                <Input value={newOptionDescription} onChange={(e) => setNewOptionDescription(e.target.value)} placeholder="Short Description..." className="h-9" />
                                            </div>
                                            <div className="col-span-1">
                                                <Input value={newOptionEmoji} onChange={(e) => setNewOptionEmoji(e.target.value)} placeholder="Emoji" title="Emoji (optional)" className="h-9 text-center px-1" />
                                            </div>
                                            <div className="col-span-3">
                                                <RoleSelect guildId={guildId} value={newRoleId} onChange={setNewRoleId} placeholder="Select role..." className="h-9" />
                                            </div>
                                        </div>
                                        <Button onClick={addOption} size="sm" variant="outline" className="w-full border-discord-blurple/20 hover:bg-discord-blurple/10 text-discord-blurple">
                                            Add Role to Dropdown
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    }
                    >
                    <div className="grid grid-cols-1 gap-4 border-b border-[#1E1F22] pb-8 mb-4">
                        <div>
                        <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Target Channel</label>
                        <ChannelSelect
                            guildId={guildId}
                            value={currentDraft.channel_id || ""}
                            onChange={(id) => updateDraft("channel_id", id)}
                            placeholder="Where should this menu go?"
                        />
                        </div>
                    </div>
                    </AdvancedEmbedEditor>
                </div>
              </div>
            ) : (
              <div className="text-discord-text-muted flex h-[600px] flex-col items-center justify-center gap-4">
                <div className="p-6 rounded-full bg-[#313338] border border-[#1E1F22]">
                    <Sparkles className="w-12 h-12 text-discord-blurple opacity-40" />
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-white">Select Menu Designer</p>
                    <p className="text-sm text-discord-text-muted max-w-xs mx-auto">Create and manage interactive role menus. Select a saved menu or add a new category to begin.</p>
                </div>
                <Button variant="discord" className="mt-2" onClick={addCategory}>
                  <PlusIcon className="w-4 h-4 mr-2" /> Create New Menu Category
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
        onConfirm={handlePromptConfirm}
        onCancel={() => setPromptOpen(false)}
      />
    </div>
  );
}

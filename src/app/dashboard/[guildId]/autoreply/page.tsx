"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api";
import { toDashboardErrorState, type DashboardErrorState } from "@/lib/dashboard-errors";
import { useToast } from "@/components/ui/toast";
import { ChannelMultiSelect } from "@/components/ui/discord-selects";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { DashboardErrorBanner } from "@/components/ui/dashboard-error-banner";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import {
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
  FolderIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  SaveIcon,
  RotateCwIcon,
} from "lucide-react";
import { PromptModal } from "@/components/ui/prompt-modal";

const DEFAULT_CATEGORY = "General";

function parseRules(rules: any[]) {
  const map: Record<string, number[]> = {};
  rules.forEach((rule, idx) => {
    const cat =
      rule && typeof rule.category === "string" && rule.category.trim()
        ? rule.category.trim()
        : DEFAULT_CATEGORY;
    if (!map[cat]) map[cat] = [];
    map[cat].push(idx);
  });
  return map;
}

export default function AutoReplyPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [rules, setRules] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState<DashboardErrorState | null>(null);

  const [promptState, setPromptState] = useState<{
    open: boolean;
    title: string;
    label?: string;
    defaultValue?: string;
    actionType: "new_rule" | "new_cat" | "rename_rule" | "delete_rule";
    targetIdx?: number;
    targetCat?: string;
  }>({
    open: false,
    title: "",
    actionType: "new_rule",
  });

  const loadRules = useCallback(() => {
    setLoadError(null);
    setInitialLoadComplete(false);
    fetchApi(`/guilds/${guildId}/autoreply`)
      .then((data) => {
        let r = data || [];
        r = r.map((rule: any) => {
          if (rule.targets && Array.isArray(rule.targets)) {
            rule.targets = rule.targets.map((t: any) =>
              typeof t === "object" ? String(t.id) : String(t)
            );
          }
          if (!rule.category || typeof rule.category !== "string") {
            rule.category = DEFAULT_CATEGORY;
          }
          return rule;
        });
        setRules(r);
        if (r.length > 0) setActiveIdx(0);
      })
      .catch((err: any) => {
        setLoadError(toDashboardErrorState(err, "Failed to load Auto Replies."));
        toast(err?.message || "Failed to load Auto Replies", "error");
      })
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const persistRules = useCallback(
    async (nextRules: any[]) => {
      await fetchApi(`/guilds/${guildId}/autoreply`, undefined, {
        method: "PUT",
        body: JSON.stringify(nextRules),
      });
    },
    [guildId]
  );

  useDebouncedAutoSave({
    value: rules,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistRules,
    onError: (err: any) => toast(err?.message || "Auto-save failed for auto replies", "error"),
  });

  const handleManualSave = async () => {
    setSaving(true);
    try {
      await persistRules(rules);
      toast("Auto Reply rules saved successfully!", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to save auto replies.", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (field: string, value: any) => {
    if (activeIdx < 0 || activeIdx >= rules.length) return;
    const newRules = [...rules];
    newRules[activeIdx] = { ...newRules[activeIdx], [field]: value };
    setRules(newRules);
  };

  const updateButton = (btnIdx: number, field: string, value: string) => {
    if (activeIdx < 0 || activeIdx >= rules.length) return;
    const newRules = [...rules];
    newRules[activeIdx] = { ...newRules[activeIdx] };
    newRules[activeIdx].buttons = [...(newRules[activeIdx].buttons || [])];

    if (!newRules[activeIdx].buttons[btnIdx]) {
      newRules[activeIdx].buttons[btnIdx] = { label: "", url: "" };
    } else {
      newRules[activeIdx].buttons[btnIdx] = { ...newRules[activeIdx].buttons[btnIdx] };
    }

    newRules[activeIdx].buttons[btnIdx][field] = value;
    setRules(newRules);
  };

  const removeButton = (btnIdx: number) => {
    if (activeIdx < 0 || activeIdx >= rules.length) return;
    const newRules = [...rules];
    newRules[activeIdx] = { ...newRules[activeIdx] };
    newRules[activeIdx].buttons = [...(newRules[activeIdx].buttons || [])];
    newRules[activeIdx].buttons.splice(btnIdx, 1);
    setRules(newRules);
  };

  const handlePromptConfirm = async (inputVal: string) => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (promptState.actionType === "new_rule") {
      const cat = promptState.targetCat || DEFAULT_CATEGORY;
      const newRule = {
        name: trimmed,
        category: cat,
        keywords: [],
        targets: [],
        buttons: [],
        reply_message: "",
      };
      const nextRules = [...rules, newRule];
      setRules(nextRules);
      setActiveIdx(nextRules.length - 1);
      await persistRules(nextRules);
      toast(`Created rule "${trimmed}"`, "success");
    } else if (promptState.actionType === "new_cat") {
      const newRule = {
        name: "New Auto Reply Rule",
        category: trimmed,
        keywords: [],
        targets: [],
        buttons: [],
        reply_message: "",
      };
      const nextRules = [...rules, newRule];
      setRules(nextRules);
      setActiveIdx(nextRules.length - 1);
      await persistRules(nextRules);
      toast(`Created category "${trimmed}"`, "success");
    } else if (promptState.actionType === "rename_rule" && promptState.targetIdx !== undefined) {
      const idx = promptState.targetIdx;
      const nextRules = [...rules];
      nextRules[idx] = { ...nextRules[idx], name: trimmed };
      setRules(nextRules);
      await persistRules(nextRules);
      toast(`Renamed to "${trimmed}"`, "success");
    } else if (promptState.actionType === "delete_rule" && promptState.targetIdx !== undefined) {
      const idx = promptState.targetIdx;
      const nextRules = rules.filter((_, i) => i !== idx);
      setRules(nextRules);
      setActiveIdx(nextRules.length > 0 ? 0 : -1);
      await persistRules(nextRules);
      toast("Rule deleted", "success");
    }
    setPromptState((prev) => ({ ...prev, open: false }));
  };

  const categories = parseRules(rules);
  const activeRule = activeIdx >= 0 && activeIdx < rules.length ? rules[activeIdx] : null;

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHero
        icon={MessageSquareIcon}
        title="Auto Reply System"
        subtitle="Define smart keyword rules, group them into categories, set target channels, and build rich reply templates."
      />

      {loadError && (
        <DashboardErrorBanner
          message={loadError.message}
          onRetry={loadRules}
          actionLabel={loadError.needsRelogin ? "Login" : undefined}
          actionHref={loadError.needsRelogin ? "/login" : undefined}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sidebar: Categories & Auto Reply Rules */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Rule Categories</h3>
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

            <div className="space-y-3">
              {Object.keys(categories).length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">
                  No auto-reply rules set up. Click below to add your first rule.
                </div>
              )}

              {Object.entries(categories).map(([categoryName, ruleIndices]) => {
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
                          {ruleIndices.length}
                        </span>
                      </button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                        title="Add rule to category"
                        onClick={() =>
                          setPromptState({
                            open: true,
                            title: `Add Rule to ${categoryName}`,
                            label: "Rule Name",
                            targetCat: categoryName,
                            actionType: "new_rule",
                          })
                        }
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {!isCollapsed && (
                      <div className="space-y-1 p-1.5 pt-0">
                        {ruleIndices.map((idx) => {
                          const rule = rules[idx];
                          const isActive = activeIdx === idx;
                          const displayName =
                            rule.name ||
                            (rule.keywords && rule.keywords.length > 0
                              ? rule.keywords.join(", ")
                              : `Rule #${idx + 1}`);

                          return (
                            <div
                              key={idx}
                              className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition cursor-pointer ${
                                isActive
                                  ? "bg-blue-600/20 font-medium text-blue-400 border border-blue-500/30"
                                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                              }`}
                              onClick={() => setActiveIdx(idx)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    rule.keywords?.length ? "bg-emerald-400" : "bg-slate-600"
                                  }`}
                                />
                                <span className="truncate">{displayName}</span>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  className="p-1 text-slate-400 hover:text-white"
                                  title="Rename"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPromptState({
                                      open: true,
                                      title: "Rename Rule",
                                      label: "New Name",
                                      defaultValue: displayName,
                                      targetIdx: idx,
                                      actionType: "rename_rule",
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
                                      title: "Delete Rule",
                                      label: `Type "${displayName}" to confirm deletion:`,
                                      defaultValue: displayName,
                                      targetIdx: idx,
                                      actionType: "delete_rule",
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
                    title: "Create Auto Reply Rule",
                    label: "Rule Name",
                    targetCat: DEFAULT_CATEGORY,
                    actionType: "new_rule",
                  })
                }
              >
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add New Rule
              </Button>
            </div>
          </div>
        </div>

        {/* Right Workspace: Auto Reply Rule Editor */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {!activeRule ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/40 text-center backdrop-blur-md">
              <MessageSquareIcon className="mb-3 h-10 w-10 text-slate-600" />
              <h3 className="text-base font-medium text-slate-300">No Rule Selected</h3>
              <p className="mt-1 text-xs text-slate-500">Select an existing auto-reply rule from the sidebar or create a new one.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md space-y-6">
              {/* Header Status & Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">
                      {activeRule.name || "Rule Configuration"}
                    </h2>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                      {activeRule.category || DEFAULT_CATEGORY}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        activeRule.keywords?.length
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {activeRule.keywords?.length ? "Active Rule" : "Needs Keywords"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Set triggering keywords, target channel filters, delete delay timer, and message template.
                  </p>
                </div>
              </div>

              {/* Rule Name & Settings */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Rule Display Name</label>
                <Input
                  value={activeRule.name || ""}
                  onChange={(e) => updateRule("name", e.target.value)}
                  placeholder="e.g. Welcome Message"
                  className="bg-black/40 text-xs text-white"
                />
              </div>

              {/* Embed Editor Integration */}
              <AdvancedEmbedEditor
                config={{
                  content: activeRule.reply_message,
                  title: activeRule.embed_title,
                  description: activeRule.embed_description,
                  color: activeRule.embed_color,
                  thumbnail_url: activeRule.embed_thumbnail,
                  footer: activeRule.embed_footer,
                  buttons: activeRule.buttons,
                }}
                onChange={(k, val) => {
                  if (k === "content") updateRule("reply_message", val);
                  else if (k === "thumbnail_url") updateRule("embed_thumbnail", val);
                  else updateRule(`embed_${k}`, val);
                }}
                bottomChildren={
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <h4 className="mb-1 text-xs font-bold text-white uppercase tracking-wider">URL Buttons (Max 5)</h4>
                    <p className="text-xs text-slate-400 mb-3">Add clickable links that appear below the auto-reply message.</p>
                    <div className="flex flex-col gap-3">
                      {(activeRule.buttons || []).map((btn: any, btnIdx: number) => (
                        <div key={btnIdx} className="flex gap-2 items-center">
                          <Input
                            placeholder="Button Label"
                            value={btn.label || ""}
                            onChange={(e) => updateButton(btnIdx, "label", e.target.value)}
                            className="bg-black/40 text-xs"
                          />
                          <Input
                            placeholder="URL (https://...)"
                            value={btn.url || ""}
                            onChange={(e) => updateButton(btnIdx, "url", e.target.value)}
                            className="bg-black/40 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            onClick={() => removeButton(btnIdx)}
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {(activeRule.buttons?.length || 0) < 5 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-fit border-dashed border-white/20 text-xs text-slate-300 hover:border-blue-500 hover:text-blue-400"
                          onClick={() => {
                            const newRules = [...rules];
                            newRules[activeIdx] = { ...newRules[activeIdx] };
                            newRules[activeIdx].buttons = [...(newRules[activeIdx].buttons || [])];
                            newRules[activeIdx].buttons.push({ label: "New Button", url: "https://" });
                            setRules(newRules);
                          }}
                        >
                          <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add Link Button
                        </Button>
                      )}
                    </div>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/10 pb-5 mb-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Keywords (Comma Separated)</label>
                    <Input
                      value={activeRule.keywords?.join(", ")}
                      onChange={(e) =>
                        updateRule(
                          "keywords",
                          e.target.value.split(",").map((k) => k.trim()).filter(Boolean)
                        )
                      }
                      placeholder="e.g. help, support, ticket"
                      className="bg-black/40 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Target Channels</label>
                    <ChannelMultiSelect
                      guildId={guildId}
                      value={activeRule.targets || []}
                      onChange={(ids) => updateRule("targets", ids)}
                      placeholder="Any Channel (leave blank)"
                      includeCategories
                      types={[0, 4, 5]}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Auto-Delete Delay (Seconds)</label>
                    <Input
                      type="number"
                      value={activeRule.delete_after || ""}
                      onChange={(e) => updateRule("delete_after", parseInt(e.target.value) || null)}
                      placeholder="Leave blank to keep"
                      className="bg-black/40 text-xs"
                    />
                  </div>
                </div>
              </AdvancedEmbedEditor>

              <div className="flex justify-end pt-3 border-t border-white/5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-semibold"
                  onClick={() =>
                    setPromptState({
                      open: true,
                      title: "Delete Auto Reply Rule",
                      label: `Type "${activeRule.name || "this rule"}" to confirm deletion:`,
                      defaultValue: activeRule.name || "",
                      targetIdx: activeIdx,
                      actionType: "delete_rule",
                    })
                  }
                >
                  <Trash2Icon className="mr-1.5 h-3.5 w-3.5" /> Delete Rule
                </Button>
              </div>
            </div>
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

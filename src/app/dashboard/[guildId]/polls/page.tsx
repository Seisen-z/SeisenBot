"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { BarChart3Icon, Clock3Icon, PlusIcon, Trash2Icon, VoteIcon } from "lucide-react";

interface PollDraft {
  name: string;
  question: string;
  channel_id: string;
  duration_hours: number;
  multiple: boolean;
  options: string[];
}

const DEFAULT_DRAFT: PollDraft = {
  name: "New Poll",
  question: "",
  channel_id: "",
  duration_hours: 24,
  multiple: false,
  options: ["Option 1", "Option 2"],
};

function normalizeDraft(raw: any): PollDraft {
  const options = Array.isArray(raw?.options)
    ? raw.options.map((opt: unknown) => String(opt || "")).filter((opt: string) => opt.trim().length > 0)
    : [];

  return {
    ...DEFAULT_DRAFT,
    ...raw,
    name: String(raw?.name || DEFAULT_DRAFT.name),
    question: String(raw?.question || ""),
    channel_id: String(raw?.channel_id || ""),
    duration_hours: Math.max(1, Math.min(168, Number(raw?.duration_hours || 24))),
    multiple: Boolean(raw?.multiple),
    options: options.length >= 2 ? options.slice(0, 10) : [...DEFAULT_DRAFT.options],
  };
}

export default function PollsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, PollDraft>>({});
  const [activeDraftKey, setActiveDraftKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/polls`)
      .then((data) => {
        const source = data && typeof data === "object" ? data : {};
        const normalized: Record<string, PollDraft> = {};

        for (const [key, value] of Object.entries(source)) {
          normalized[key] = normalizeDraft(value);
        }

        if (Object.keys(normalized).length === 0) {
          normalized["Poll 1"] = { ...DEFAULT_DRAFT, name: "Poll 1" };
        }

        setDrafts(normalized);
        setActiveDraftKey(Object.keys(normalized)[0] || "");
      })
      .catch(() => toast("Failed to load poll drafts", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistDrafts = useCallback(async (nextDrafts: Record<string, PollDraft>) => {
    await fetchApi(`/guilds/${guildId}/polls`, undefined, {
      method: "PUT",
      body: JSON.stringify(nextDrafts),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: drafts,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1500,
    onSave: persistDrafts,
    onError: () => toast("Auto-save failed for poll drafts", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistDrafts(drafts);
      toast("Poll drafts saved!");
    } catch {
      toast("Failed to save poll drafts.", "error");
    } finally {
      setSaving(false);
    }
  };

  const activeDraft = drafts[activeDraftKey];
  const cleanedOptions = (activeDraft?.options || []).map((opt) => opt.trim()).filter(Boolean).slice(0, 10);
  const canPost = Boolean(activeDraft?.channel_id && activeDraft?.question.trim().length >= 5 && cleanedOptions.length >= 2);

  const updateDraft = (patch: Partial<PollDraft>) => {
    if (!activeDraftKey) return;
    setDrafts((prev) => ({
      ...prev,
      [activeDraftKey]: {
        ...prev[activeDraftKey],
        ...patch,
      },
    }));
  };

  const addDraft = () => {
    const nextIndex = Object.keys(drafts).length + 1;
    let key = `Poll ${nextIndex}`;
    while (drafts[key]) {
      key = `Poll ${Math.floor(Math.random() * 10000)}`;
    }

    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...DEFAULT_DRAFT,
        name: key,
      },
    }));
    setActiveDraftKey(key);
  };

  const removeDraft = (key: string) => {
    const updated = { ...drafts };
    delete updated[key];

    if (Object.keys(updated).length === 0) {
      updated["Poll 1"] = { ...DEFAULT_DRAFT, name: "Poll 1" };
    }

    setDrafts(updated);
    setActiveDraftKey(Object.keys(updated)[0] || "");
  };

  const addOption = () => {
    if (!activeDraft) return;
    if ((activeDraft.options || []).length >= 10) {
      toast("Poll supports up to 10 options.", "error");
      return;
    }
    updateDraft({ options: [...(activeDraft.options || []), `Option ${(activeDraft.options || []).length + 1}`] });
  };

  const updateOption = (index: number, value: string) => {
    if (!activeDraft) return;
    const options = [...(activeDraft.options || [])];
    options[index] = value;
    updateDraft({ options });
  };

  const removeOption = (index: number) => {
    if (!activeDraft) return;
    const options = (activeDraft.options || []).filter((_, idx) => idx !== index);
    if (options.length < 2) {
      toast("A poll needs at least 2 options.", "error");
      return;
    }
    updateDraft({ options });
  };

  const postPoll = async () => {
    if (!activeDraft) return;

    const question = activeDraft.question.trim();
    const options = (activeDraft.options || []).map((opt) => opt.trim()).filter(Boolean).slice(0, 10);
    if (!activeDraft.channel_id) {
      toast("Select a target channel first.", "error");
      return;
    }
    if (question.length < 5) {
      toast("Question must be at least 5 characters.", "error");
      return;
    }
    if (options.length < 2) {
      toast("Add at least 2 valid options.", "error");
      return;
    }

    setPosting(true);
    try {
      await fetchApi("/trigger/create_poll", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_id: activeDraft.channel_id,
            question,
            options,
            duration_hours: activeDraft.duration_hours || 24,
            multiple: Boolean(activeDraft.multiple),
          },
        }),
      });
      toast("Poll posted! Members will see live results right after voting.");
    } catch (err: any) {
      toast(`Failed to post poll: ${err.message}`, "error");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={BarChart3Icon}
        title="Polls"
        subtitle="Build Discord-native polls with clean visuals, live vote updates, and hidden results until members vote."
        stats={[
          { label: "Drafts", value: Object.keys(drafts).length },
          { label: "Options", value: cleanedOptions.length },
          { label: "Duration", value: `${activeDraft?.duration_hours || 24}h` },
          { label: "Ready", value: canPost ? "Yes" : "No" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Drafts"}
            </Button>
            <Button variant="discord" onClick={postPoll} disabled={posting || !canPost}>
              {posting ? "Posting..." : "Post Poll"}
            </Button>
          </div>
        }
      />

      <div className="flex gap-6 min-h-[620px]">
        <div className="w-64 shrink-0 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-discord-text-muted">Drafts</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addDraft}>
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            {Object.keys(drafts).map((key) => (
              <div key={key} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveDraftKey(key)}
                  className={`flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeDraftKey === key
                      ? "bg-discord-blurple text-white"
                      : "text-discord-text-muted hover:bg-[#383A40] hover:text-white"
                  }`}
                >
                  {drafts[key].name || key}
                </button>
                <button
                  type="button"
                  onClick={() => removeDraft(key)}
                  className="rounded-md p-1 text-red-400 opacity-0 transition hover:bg-red-500/10 group-hover:opacity-100"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
          {!activeDraft ? (
            <div className="flex h-full items-center justify-center text-sm text-discord-text-muted">Select a draft.</div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Draft Name</label>
                  <Input
                    value={activeDraft.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      updateDraft({ name: nextName });
                    }}
                    placeholder="Weekly Balance Poll"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Question</label>
                  <Textarea
                    value={activeDraft.question}
                    onChange={(e) => updateDraft({ question: e.target.value })}
                    placeholder="What should we focus less on in next week's updates?"
                    className="min-h-[100px]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Target Channel</label>
                    <ChannelSelect
                      guildId={guildId}
                      value={activeDraft.channel_id || ""}
                      onChange={(id) => updateDraft({ channel_id: id })}
                      placeholder="Select channel..."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Duration (Hours)</label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={activeDraft.duration_hours || 24}
                      onChange={(e) => updateDraft({ duration_hours: Math.max(1, Math.min(168, Number(e.target.value) || 24)) })}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#1f2a38]/60 px-3 py-2 text-sm text-discord-text">
                  <input
                    type="checkbox"
                    checked={Boolean(activeDraft.multiple)}
                    onChange={(e) => updateDraft({ multiple: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Allow multiple answers per member
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Options</label>
                    <Button variant="outline" size="sm" onClick={addOption} disabled={(activeDraft.options || []).length >= 10}>
                      <PlusIcon className="mr-1 h-3.5 w-3.5" /> Add Option
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(activeDraft.options || []).map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => removeOption(index)}
                          disabled={(activeDraft.options || []).length <= 2}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#1E1F22] bg-[#2f3136] p-4 shadow-inner">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-discord-text-muted">Live Preview</p>
                <div className="rounded-xl border border-white/10 bg-[#36393f] p-4">
                  <p className="text-sm font-semibold leading-relaxed text-[#f2f3f5]">
                    {activeDraft.question?.trim() || "Your poll question will appear here..."}
                  </p>

                  <div className="mt-3 space-y-2">
                    {cleanedOptions.length > 0 ? (
                      cleanedOptions.map((option, idx) => (
                        <div key={idx} className="rounded-md bg-[#4a4d57] px-3 py-2 text-sm text-[#f2f3f5]">
                          {option}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md bg-[#4a4d57] px-3 py-2 text-sm text-[#f2f3f5]">Add options to preview.</div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#b5bac1]">
                    <span className="flex items-center gap-1.5"><VoteIcon className="h-3.5 w-3.5" /> Live results after vote</span>
                    <span className="flex items-center gap-1.5"><Clock3Icon className="h-3.5 w-3.5" /> {activeDraft.duration_hours || 24}h</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

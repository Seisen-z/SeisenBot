"use client";

import { useState, use } from "react";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import {
  SendIcon,
  RotateCwIcon,
  GlobeIcon,
  MessageSquareIcon,
  CheckCircle2Icon,
  TagIcon,
} from "lucide-react";

const TAGS = ["Update", "New Script", "Patch", "Maintenance", "Announcement"] as const;
type Tag = (typeof TAGS)[number];

const TAG_COLORS: Record<Tag, string> = {
  "Update":       "border-amber-500/40 bg-amber-500/10 text-amber-300",
  "New Script":   "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  "Patch":        "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  "Maintenance":  "border-purple-500/40 bg-purple-500/10 text-purple-300",
  "Announcement": "border-blue-500/40 bg-blue-500/10 text-blue-300",
};

export default function WebsiteUpdatesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [title, setTitle]         = useState("");
  const [content, setContent]     = useState("");
  const [tag, setTag]             = useState<Tag>("Update");
  const [imageUrl, setImageUrl]   = useState("");
  const [postToDiscord, setPostToDiscord] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [pingRoleId, setPingRoleId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [lastPublished, setLastPublished] = useState<string | null>(null);

  const canPublish = title.trim().length > 0 && content.trim().length > 0 && (!postToDiscord || channelId);

  const handlePublish = async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);
    try {
      await fetchApi("/trigger/site_update", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            title: title.trim(),
            content: content.trim(),
            tag,
            image_url: imageUrl.trim() || null,
            post_to_discord: postToDiscord,
            channel_id: postToDiscord ? channelId : null,
            ping_role_id: postToDiscord ? pingRoleId : null,
          },
        }),
      });
      toast("Update published to Seisen website" + (postToDiscord ? " and Discord!" : "!"), "success");
      setLastPublished(new Date().toLocaleString());
      setTitle("");
      setContent("");
      setImageUrl("");
    } catch (err: any) {
      toast(`Failed to publish: ${err.message}`, "error");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHero
        title="Website Updates"
        subtitle="Publish update posts directly to the Seisen Premium website. Optionally also post to a Discord channel at the same time."
        icon={GlobeIcon}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: compose form */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5">

          {/* Main compose card */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />

            <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">Compose Update</h2>
                <p className="text-xs text-slate-400 mt-0.5">Fill in the details below and hit Publish.</p>
              </div>
              {lastPublished && (
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2Icon className="h-3.5 w-3.5" />
                  Last published: {lastPublished}
                </div>
              )}
            </div>

            {/* Tag selector */}
            <div className="relative z-10 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <TagIcon className="h-3.5 w-3.5 text-slate-400" /> Update Tag
              </label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTag(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-150 cursor-pointer ${
                      tag === t
                        ? TAG_COLORS[t] + " scale-105 shadow-md"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="relative z-10 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Title <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="e.g. Blox Fruits script updated to patch 68"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-black/40 text-sm text-white placeholder:text-slate-500 border-white/10 focus:border-amber-500/50"
                maxLength={120}
              />
              <p className="text-[11px] text-slate-600 text-right">{title.length}/120</p>
            </div>

            {/* Content */}
            <div className="relative z-10 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Content <span className="text-rose-400">*</span>
              </label>
              <Textarea
                placeholder="Describe the update, patch notes, or announcement in detail..."
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="bg-black/40 text-sm text-white placeholder:text-slate-500 min-h-[180px] resize-y border-white/10 focus:border-amber-500/50"
              />
            </div>

            {/* Image URL */}
            <div className="relative z-10 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Banner Image URL (optional)</label>
              <Input
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="bg-black/40 text-sm text-white placeholder:text-slate-500 border-white/10 focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Discord cross-post toggle */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MessageSquareIcon className="h-4 w-4 text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-white">Also Post to Discord</p>
                  <p className="text-xs text-slate-400">Send the same update to a Discord channel simultaneously.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPostToDiscord((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 cursor-pointer ${
                  postToDiscord
                    ? "bg-blue-600 border-blue-500"
                    : "bg-white/10 border-white/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    postToDiscord ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {postToDiscord && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-1 border-t border-white/5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Target Channel <span className="text-rose-400">*</span>
                  </label>
                  <ChannelSelect
                    guildId={guildId}
                    value={channelId}
                    onChange={setChannelId}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Ping Role (optional)</label>
                  <Input
                    placeholder="Role ID to ping..."
                    value={pingRoleId}
                    onChange={(e) => setPingRoleId(e.target.value)}
                    className="bg-black/40 text-sm text-white placeholder:text-slate-500 border-white/10"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: preview + publish */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-5">
          {/* Publish card */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl shadow-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Publish</h3>

            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${title.trim() ? "bg-emerald-500" : "bg-slate-600"}`} />
                Title {title.trim() ? "set" : "required"}
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${content.trim() ? "bg-emerald-500" : "bg-slate-600"}`} />
                Content {content.trim() ? "set" : "required"}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                Tag: <span className="text-white font-semibold">{tag}</span>
              </div>
              {postToDiscord && (
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${channelId ? "bg-emerald-500" : "bg-rose-500"}`} />
                  Discord channel {channelId ? "set" : "required"}
                </div>
              )}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-amber-600/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              disabled={!canPublish || publishing}
              onClick={handlePublish}
            >
              {publishing ? (
                <><RotateCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Publishing...</>
              ) : (
                <><SendIcon className="mr-1.5 h-3.5 w-3.5" /> Publish Update</>
              )}
            </Button>
          </div>

          {/* Live preview */}
          {(title || content) && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl shadow-2xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Preview</h3>
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${TAG_COLORS[tag]}`}>
                  {tag}
                </span>
                {title && <p className="text-sm font-bold text-white leading-snug">{title}</p>}
                {content && (
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 whitespace-pre-wrap">{content}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

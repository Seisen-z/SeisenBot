"use client";

import { use, useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChannelSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import {
  ClipboardListIcon, CheckIcon, XIcon, ClockIcon,
  ChevronDownIcon, ChevronUpIcon, SettingsIcon, ListIcon,
  Trash2Icon, SendIcon, Hash,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelConfig = {
  channel_id: string;
  log_channel_id: string;
  interview_category_id: string;
  interviewer_role_ids: string[];
  message_id?: string;
  title: string;
  description: string;
  accept_roles: { staff: string; tester: string; helper: string };
};

type Application = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  position: "helper" | "staff" | "tester";
  answers: Record<string, string>;
  submitted_at: string;
  status: "pending" | "accepted" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
};

// ─── Metadata ─────────────────────────────────────────────────────────────────

const POSITION_META = {
  helper: { label: "Helper", emoji: "🤝", color: "text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/30" },
  staff:  { label: "Staff",  emoji: "🛡️", color: "text-[#ED4245] bg-[#ED4245]/10 border-[#ED4245]/30" },
  tester: { label: "Tester", emoji: "🧪", color: "text-[#57F287] bg-[#57F287]/10 border-[#57F287]/30" },
};

const STATUS_META = {
  pending:  { label: "Pending",  icon: ClockIcon,  color: "text-[#FEE75C] bg-[#FEE75C]/10 border-[#FEE75C]/30" },
  accepted: { label: "Accepted", icon: CheckIcon,  color: "text-[#57F287] bg-[#57F287]/10 border-[#57F287]/30" },
  rejected: { label: "Rejected", icon: XIcon,      color: "text-[#ED4245] bg-[#ED4245]/10 border-[#ED4245]/30" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Application Card ─────────────────────────────────────────────────────────

function ApplicationCard({
  app,
  guildId,
  onUpdateStatus,
}: {
  app: Application;
  guildId: string;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelName, setChannelName] = useState(`interview-${app.username.split("#")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")}`);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const pos = POSITION_META[app.position];
  const stat = STATUS_META[app.status];
  const StatIcon = stat.icon;

  const handle = async (status: string) => {
    setUpdating(true);
    await onUpdateStatus(app.id, status);
    setUpdating(false);
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return toast("Enter a channel name.", "error");
    setCreating(true);
    try {
      const res = await fetchApi(`/trigger/apppanel_create_channel`, undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: { user_id: app.user_id, channel_name: channelName.trim(), role_ids: roleIds },
        }),
      });
      const roles = res?.assigned_roles?.length ? ` and assigned: ${res.assigned_roles.join(", ")}` : "";
      toast(`✅ Created #${res?.channel_name}${roles}`);
      setShowChannelForm(false);
    } catch (e: any) {
      toast(e?.message || "Failed to create channel.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#1E1F22] bg-[#141518] overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <img
          src={app.avatar_url}
          alt={app.display_name}
          className="w-9 h-9 rounded-full ring-1 ring-white/10 shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{app.display_name}</span>
            <span className="text-xs text-[#6b7280]">@{app.username}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${pos.color}`}>
              {pos.emoji} {pos.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${stat.color}`}>
              <StatIcon className="w-3 h-3" />
              {stat.label}
            </span>
            <span className="text-[11px] text-[#6b7280]">{timeAgo(app.submitted_at)}</span>
            <span className="text-[11px] text-[#4B4D55] font-mono">#{app.id}</span>
          </div>
        </div>
        <div className="shrink-0 text-[#6b7280]">
          {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#1E1F22] px-4 py-4 space-y-4">
          {Object.entries(app.answers).map(([q, a]) => (
            <div key={q}>
              <p className="text-xs font-semibold text-[#B5BAC1] mb-1">{q}</p>
              <p className="text-sm text-white whitespace-pre-wrap bg-[#0e0f11] rounded-lg px-3 py-2 border border-[#1E1F22]">{a || "—"}</p>
            </div>
          ))}
          {app.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => handle("accepted")}
                disabled={updating}
                className="bg-[#57F287]/15 hover:bg-[#57F287]/25 border border-[#57F287]/40 text-[#57F287] text-sm px-4"
              >
                <CheckIcon className="w-4 h-4 mr-1.5" /> Accept
              </Button>
              <Button
                onClick={() => handle("rejected")}
                disabled={updating}
                className="bg-[#ED4245]/15 hover:bg-[#ED4245]/25 border border-[#ED4245]/40 text-[#ED4245] text-sm px-4"
              >
                <XIcon className="w-4 h-4 mr-1.5" /> Reject
              </Button>
            </div>
          )}
          {app.status !== "pending" && app.reviewed_at && (
            <p className="text-xs text-[#6b7280]">Reviewed {timeAgo(app.reviewed_at)}</p>
          )}

          {/* Create Channel & Assign Roles */}
          {app.status !== "rejected" && (
            <div className="border-t border-[#1E1F22] pt-3 mt-1">
              {!showChannelForm ? (
                <button
                  onClick={() => setShowChannelForm(true)}
                  className="flex items-center gap-1.5 text-xs text-[#5865F2] hover:text-white transition-colors font-medium"
                >
                  <Hash className="w-3.5 h-3.5" /> Create Interview Channel &amp; Assign Roles
                </button>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-[#1E1F22] bg-[#0e0f11] p-3">
                  <p className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wide">Create Interview Channel</p>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#6b7280]">Channel Name</label>
                    <Input
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      placeholder="interview-username"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#6b7280]">Roles to Assign (optional)</label>
                    <RoleMultiSelect
                      guildId={guildId}
                      value={roleIds}
                      onChange={setRoleIds}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateChannel}
                      disabled={creating || !channelName.trim()}
                      className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs px-4"
                    >
                      <Hash className="w-3.5 h-3.5 mr-1.5" />
                      {creating ? "Creating…" : "Create Channel"}
                    </Button>
                    <Button
                      onClick={() => setShowChannelForm(false)}
                      className="bg-transparent border border-[#1E1F22] text-[#6b7280] hover:text-white text-xs px-4"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Save Roles Button ────────────────────────────────────────────────────────

function SaveRolesButton({ guildId, acceptRoles }: { guildId: string; acceptRoles: PanelConfig["accept_roles"] }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/apppanel`, undefined, {
        method: "PUT",
        body: JSON.stringify({ accept_roles: acceptRoles }),
      });
      toast("✅ Accept roles saved!");
    } catch (e: any) {
      toast(e?.message || "Failed to save roles.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button onClick={handleSave} disabled={saving} className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs">
      {saving ? "Saving…" : "Save Roles"}
    </Button>
  );
}

// ─── Setup Tab ────────────────────────────────────────────────────────────────

function SetupTab({ guildId }: { guildId: string }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<PanelConfig>({
    channel_id: "",
    log_channel_id: "",
    interview_category_id: "",
    interviewer_role_ids: [],
    title: "📋 Staff Applications",
    description: "Click a button below to apply for a staff position in this server.",
    accept_roles: { staff: "", tester: "", helper: "" },
  });
  const [loaded, setLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/apppanel`)
      .then((data) => {
        if (data && (data.channel_id || data.message_id)) {
          const ar = data.accept_roles || {};
          setConfig({
            channel_id: String(data.channel_id || ""),
            log_channel_id: String(data.log_channel_id || ""),
            interview_category_id: String(data.interview_category_id || ""),
            interviewer_role_ids: Array.isArray(data.interviewer_role_ids) ? data.interviewer_role_ids.map(String) : [],
            message_id: data.message_id ? String(data.message_id) : undefined,
            title: data.title || "📋 Staff Applications",
            description: data.description || "Click a button below to apply for a staff position in this server.",
            accept_roles: {
              staff: String(ar.staff || ""),
              tester: String(ar.tester || ""),
              helper: String(ar.helper || ""),
            },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [guildId]);

  const set = (k: keyof PanelConfig, v: string) => setConfig((p) => ({ ...p, [k]: v }));

  const handlePost = async () => {
    if (!config.channel_id) return toast("Select a panel channel first.", "error");
    if (!config.log_channel_id) return toast("Select a log channel first.", "error");
    setPosting(true);
    try {
      const isLiveUpdate = !!config.message_id;
      const action = isLiveUpdate ? "apppanel_update" : "apppanel_post";
      // Persist accept_roles immediately (independent of panel post/update)
      await fetchApi(`/guilds/${guildId}/apppanel`, undefined, {
        method: "PUT",
        body: JSON.stringify({
          accept_roles: config.accept_roles,
          interview_category_id: config.interview_category_id,
          interviewer_role_ids: config.interviewer_role_ids,
        }),
      }).catch(() => {});

      const res = await fetchApi(`/trigger/${action}`, undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            channel_id: config.channel_id,
            log_channel_id: config.log_channel_id,
            message_id: config.message_id,
            title: config.title,
            description: config.description,
            interview_category_id: config.interview_category_id,
            interviewer_role_ids: config.interviewer_role_ids,
          },
        }),
      });
      if (res?.message_id) {
        setConfig((p) => ({ ...p, message_id: String(res.message_id) }));
        toast(isLiveUpdate ? "✅ Panel updated!" : "✅ Application panel posted!");
      } else {
        throw new Error(res?.message || "No message_id returned.");
      }
    } catch (e: any) {
      toast(e?.message || "Failed to post panel.", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete the application panel from Discord? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetchApi(`/trigger/apppanel_delete`, undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            message_id: config.message_id,
            channel_id: config.channel_id,
          },
        }),
      });
      setConfig((p) => ({ ...p, message_id: undefined }));
      toast("🗑️ Panel deleted.");
    } catch (e: any) {
      toast(e?.message || "Failed to delete panel.", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!loaded) {
    return <div className="py-16 text-center text-[#6b7280] text-sm">Loading config…</div>;
  }

  const isLive = !!config.message_id;

  return (
    <div className="flex flex-col gap-6">
      {/* Status banner */}
      {isLive ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#57F287]/20 bg-[#57F287]/5 px-4 py-3">
          <span className="w-2 h-2 rounded-full bg-[#57F287] shrink-0 animate-pulse" />
          <span className="text-sm text-[#57F287] font-medium">Panel is live</span>
          <span className="text-xs text-[#6b7280] font-mono ml-1">msg:{config.message_id}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-[#FEE75C]/20 bg-[#FEE75C]/5 px-4 py-3">
          <span className="w-2 h-2 rounded-full bg-[#FEE75C] shrink-0" />
          <span className="text-sm text-[#FEE75C] font-medium">No panel posted yet</span>
        </div>
      )}

      {/* Channels */}
      <div className="rounded-xl border border-[#1E1F22] bg-[#141518] p-5 flex flex-col gap-5">
        <h3 className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wider">Channels</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide">
              Panel Channel <span className="text-[#ED4245]">*</span>
            </label>
            <ChannelSelect
              guildId={guildId}
              value={config.channel_id}
              onChange={(v) => set("channel_id", v)}
              placeholder="Where to post the apply buttons…"
            />
            <p className="mt-1 text-[11px] text-[#6b7280]">The channel where the embed with Helper/Staff/Tester buttons will appear.</p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide">
              Log Channel <span className="text-[#ED4245]">*</span>
            </label>
            <ChannelSelect
              guildId={guildId}
              value={config.log_channel_id}
              onChange={(v) => set("log_channel_id", v)}
              placeholder="Where to send submission logs…"
            />
            <p className="mt-1 text-[11px] text-[#6b7280]">Each submitted application is posted here as an embed.</p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide">
              Interview Category
            </label>
            <ChannelSelect
              guildId={guildId}
              value={config.interview_category_id}
              onChange={(v) => set("interview_category_id", v)}
              placeholder="Category for interview channels…"
              channelType="category"
            />
            <p className="mt-1 text-[11px] text-[#6b7280]">Interview channels created from the log button will be placed here.</p>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide">
              Interviewer Roles
            </label>
            <RoleMultiSelect
              guildId={guildId}
              value={config.interviewer_role_ids}
              onChange={(ids) => setConfig((p) => ({ ...p, interviewer_role_ids: ids }))}
            />
            <p className="mt-1 text-[11px] text-[#6b7280]">These roles will have read & send access in every interview channel created from Discord.</p>
          </div>
        </div>
      </div>

      {/* Embed content */}
      <div className="rounded-xl border border-[#1E1F22] bg-[#141518] p-5 flex flex-col gap-4">
        <h3 className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wider">Panel Embed</h3>
        <div>
          <label className="mb-2 block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide">Title</label>
          <Input
            value={config.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="📋 Staff Applications"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold text-[#B5BAC1] uppercase tracking-wide">Description</label>
          <textarea
            value={config.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Click a button below to apply…"
            className="w-full rounded-lg border border-[#1E1F22] bg-[#0e0f11] px-3 py-2 text-sm text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#5865F2] resize-y min-h-[160px]"
            style={{ height: "160px" }}
          />
        </div>

        {/* Preview */}
        <div className="rounded-lg border-l-4 border-[#5865F2] bg-[#0e0f11] px-4 py-3">
          <p className="text-sm font-semibold text-white">{config.title || "📋 Staff Applications"}</p>
          <p className="text-xs text-[#B5BAC1] mt-1 whitespace-pre-wrap">{config.description || "Click a button below to apply…"}</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              { label: "🛡️ Apply as Staff", cls: "bg-[#ED4245]/20 text-[#ED4245] border-[#ED4245]/30" },
              { label: "🧪 Apply as Tester", cls: "bg-[#57F287]/20 text-[#57F287] border-[#57F287]/30" },
              { label: "🤝 Apply as Helper", cls: "bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30" },
            ].map(({ label, cls }) => (
              <span key={label} className={`px-3 py-1 rounded text-xs font-semibold border ${cls}`}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Accept Roles */}
      <div className="rounded-xl border border-[#1E1F22] bg-[#141518] p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wider">Auto-Assign Roles on Accept</h3>
          <p className="text-[11px] text-[#6b7280] mt-1">When you accept an application, the matching role is automatically given to that user.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { key: "staff",  label: "🛡️ Staff Role",  color: "text-[#ED4245]" },
            { key: "tester", label: "🧪 Tester Role", color: "text-[#57F287]" },
            { key: "helper", label: "🤝 Helper Role", color: "text-[#5865F2]" },
          ] as const).map(({ key, label, color }) => (
            <div key={key}>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</label>
              <RoleMultiSelect
                guildId={guildId}
                value={config.accept_roles[key] ? [config.accept_roles[key]] : []}
                onChange={(ids) => setConfig((p) => ({ ...p, accept_roles: { ...p.accept_roles, [key]: ids[0] || "" } }))}
              />
            </div>
          ))}
        </div>
        <div>
          <SaveRolesButton guildId={guildId} acceptRoles={config.accept_roles} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {isLive ? (
          <>
            <Button
              onClick={handlePost}
              disabled={posting}
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
            >
              <SendIcon className="w-4 h-4 mr-2" />
              {posting ? "Updating…" : "Update Panel"}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#ED4245]/15 hover:bg-[#ED4245]/25 border border-[#ED4245]/40 text-[#ED4245]"
            >
              <Trash2Icon className="w-4 h-4 mr-2" />
              {deleting ? "Deleting…" : "Delete Panel"}
            </Button>
          </>
        ) : (
          <Button
            onClick={handlePost}
            disabled={posting || !config.channel_id || !config.log_channel_id}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
          >
            <SendIcon className="w-4 h-4 mr-2" />
            {posting ? "Posting…" : "Post Panel to Discord"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Applications Tab ─────────────────────────────────────────────────────────

function ApplicationsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi(`/guilds/${guildId}/applications`);
      setApps(data?.applications || []);
      setCounts(data?.counts || { pending: 0, accepted: 0, rejected: 0 });
    } catch {
      toast("Failed to load applications", "error");
    } finally {
      setLoading(false);
    }
  }, [guildId, toast]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = useCallback(async (appId: string, status: string) => {
    await fetchApi(`/guilds/${guildId}/applications/${appId}`, undefined, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: status as any, reviewed_at: new Date().toISOString() } : a));
    setCounts((prev) => {
      const next = { ...prev };
      next.pending = Math.max(0, next.pending - 1);
      if (status === "accepted") next.accepted++;
      else if (status === "rejected") next.rejected++;
      return next;
    });
    toast(`Application ${status}!`);
  }, [guildId, toast]);

  const POS_TABS = ["all", "helper", "staff", "tester"];
  const STATUS_TABS = ["all", "pending", "accepted", "rejected"];

  const filtered = apps.filter((a) => {
    if (posFilter !== "all" && a.position !== posFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: apps.length, color: "text-white" },
          { label: "Pending", value: counts.pending, color: "text-[#FEE75C]" },
          { label: "Accepted", value: counts.accepted, color: "text-[#57F287]" },
          { label: "Rejected", value: counts.rejected, color: "text-[#ED4245]" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#1E1F22] bg-[#141518] px-4 py-3">
            <p className="text-xs text-[#6b7280] uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Refresh */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1 bg-[#141518] border border-[#1E1F22] rounded-xl p-1">
          {POS_TABS.map((t) => (
            <button key={t} onClick={() => setPosFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${posFilter === t ? "bg-[#5865F2] text-white" : "text-[#6b7280] hover:text-white"}`}>
              {t === "all" ? "All Positions" : `${POSITION_META[t as keyof typeof POSITION_META]?.emoji} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[#141518] border border-[#1E1F22] rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button key={t} onClick={() => setStatusFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${statusFilter === t ? "bg-[#5865F2] text-white" : "text-[#6b7280] hover:text-white"}`}>
              {t === "all" ? "All Statuses" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Button onClick={load} className="ml-auto bg-[#1E1F22] hover:bg-[#2B2D31] text-[#B5BAC1] border border-[#1E1F22] text-xs">
          Refresh
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-[#6b7280] text-sm">Loading applications…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[#6b7280] text-sm">
          {apps.length === 0 ? "No applications yet. Set up and post a panel in the Setup tab." : "No applications match the current filters."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((app) => (
            <ApplicationCard key={app.id} app={app} guildId={guildId} onUpdateStatus={handleUpdateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "setup" | "applications";

export default function ApplicationsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const [tab, setTab] = useState<Tab>("setup");

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-6">
      <DashboardPageHero
        icon={ClipboardListIcon}
        title="Staff Applications"
        subtitle="Configure your application panel and review submitted applications."
      />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#141518] border border-[#1E1F22] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("setup")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "setup" ? "bg-[#5865F2] text-white" : "text-[#6b7280] hover:text-white"}`}
        >
          <SettingsIcon className="w-4 h-4" /> Setup
        </button>
        <button
          onClick={() => setTab("applications")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "applications" ? "bg-[#5865F2] text-white" : "text-[#6b7280] hover:text-white"}`}
        >
          <ListIcon className="w-4 h-4" /> Applications
        </button>
      </div>

      {tab === "setup" ? <SetupTab guildId={guildId} /> : <ApplicationsTab guildId={guildId} />}
    </div>
  );
}

"use client";

import { use, useCallback, useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { Button } from "@/components/ui/button";
import { ClipboardListIcon, CheckIcon, XIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

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
  notes: string | null;
};

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

function ApplicationCard({
  app,
  onUpdateStatus,
}: {
  app: Application;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const pos = POSITION_META[app.position];
  const stat = STATUS_META[app.status];
  const StatIcon = stat.icon;

  const handle = async (status: string) => {
    setUpdating(true);
    await onUpdateStatus(app.id, status);
    setUpdating(false);
  };

  return (
    <div className="rounded-xl border border-[#1E1F22] bg-[#141518] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Avatar */}
        <img
          src={app.avatar_url}
          alt={app.display_name}
          className="w-9 h-9 rounded-full ring-1 ring-white/10 shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />

        {/* Name + meta */}
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

        {/* Expand toggle */}
        <div className="shrink-0 text-[#6b7280]">
          {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </div>
      </div>

      {/* Answers */}
      {expanded && (
        <div className="border-t border-[#1E1F22] px-4 py-4 space-y-4">
          {Object.entries(app.answers).map(([q, a]) => (
            <div key={q}>
              <p className="text-xs font-semibold text-[#B5BAC1] mb-1">{q}</p>
              <p className="text-sm text-white whitespace-pre-wrap bg-[#0e0f11] rounded-lg px-3 py-2 border border-[#1E1F22]">{a || "—"}</p>
            </div>
          ))}

          {/* Actions */}
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
            <p className="text-xs text-[#6b7280]">
              Reviewed {timeAgo(app.reviewed_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [apps, setApps] = useState<Application[]>([]);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
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
    try {
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
    } catch {
      toast("Failed to update application", "error");
    }
  }, [guildId, toast]);

  const filtered = apps.filter((a) => {
    if (posFilter !== "all" && a.position !== posFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const POS_TABS = ["all", "helper", "staff", "tester"];
  const STATUS_TABS = ["all", "pending", "accepted", "rejected"];

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-6">
      <DashboardPageHero
        icon={ClipboardListIcon}
        title="Staff Applications"
        subtitle="Review applications submitted via the in-server panel."
        stats={[
          { label: "Total", value: apps.length },
          { label: "Pending", value: counts.pending },
          { label: "Accepted", value: counts.accepted },
          { label: "Rejected", value: counts.rejected },
        ]}
        actions={
          <Button onClick={load} className="bg-[#5865F2] hover:bg-[#4752C4] text-sm">
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-1 bg-[#141518] border border-[#1E1F22] rounded-xl p-1">
          {POS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setPosFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                posFilter === t ? "bg-[#5865F2] text-white" : "text-[#6b7280] hover:text-white"
              }`}
            >
              {t === "all" ? "All Positions" : `${POSITION_META[t as keyof typeof POSITION_META]?.emoji} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[#141518] border border-[#1E1F22] rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setStatusFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === t ? "bg-[#5865F2] text-white" : "text-[#6b7280] hover:text-white"
              }`}
            >
              {t === "all" ? "All Statuses" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-[#6b7280] text-sm">Loading applications…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[#6b7280] text-sm">
          {apps.length === 0 ? "No applications yet. Set up a panel with /apppanel setup." : "No applications match the current filters."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((app) => (
            <ApplicationCard key={app.id} app={app} onUpdateStatus={handleUpdateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

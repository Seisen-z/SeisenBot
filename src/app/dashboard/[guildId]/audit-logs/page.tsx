"use client";

import { useCallback, useEffect, useState, use } from "react";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import {
  ShieldAlertIcon,
  SearchIcon,
  RefreshCwIcon,
  Trash2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  MegaphoneIcon,
  RotateCwIcon,
  ShieldCheckIcon,
  SettingsIcon,
  BotIcon,
  UserIcon,
} from "lucide-react";

type AuditLogEntry = {
  id: string;
  category: string;
  action: string;
  actor: string;
  details: string;
  metadata: Record<string, any>;
  timestamp: string;
};

const CATEGORIES = ["All", "Announcements", "Auto-Post", "Moderation", "Settings", "Bot System"];

export default function AuditLogsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/guilds/${guildId}/audit_logs?`;
      if (selectedCategory !== "All") url += `category=${encodeURIComponent(selectedCategory)}&`;
      if (searchQuery.trim()) url += `q=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetchApi(url);
      if (Array.isArray(res)) {
        setLogs(res);
      } else {
        setLogs([]);
      }
    } catch (err: any) {
      toast("Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [guildId, selectedCategory, searchQuery, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearAuditLogs = async () => {
    const isConfirmed = window.confirm("Are you sure you want to clear all audit logs for this server?");
    if (!isConfirmed) return;

    try {
      await fetchApi(`/guilds/${guildId}/audit_logs`, undefined, { method: "DELETE" });
      setLogs([]);
      toast("Audit logs cleared successfully", "success");
    } catch {
      toast("Failed to clear audit logs", "error");
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Announcements":
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
            <MegaphoneIcon className="w-3 h-3" /> Announcements
          </span>
        );
      case "Auto-Post":
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
            <RotateCwIcon className="w-3 h-3" /> Auto-Post
          </span>
        );
      case "Moderation":
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
            <ShieldCheckIcon className="w-3 h-3" /> Moderation
          </span>
        );
      case "Settings":
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            <SettingsIcon className="w-3 h-3" /> Settings
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-full">
            <BotIcon className="w-3 h-3" /> {category}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHero
        title="Audit Logs"
        subtitle="System-wide audit trail recording all bot actions, published announcements, auto-posts, and setting updates."
      />

      {/* Header controls & Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? "bg-discord-blurple text-white shadow"
                    : "bg-black/20 text-discord-text-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchLogs}
              disabled={loading}
              className="h-8 text-xs border-white/10"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {logs.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAuditLogs}
                className="h-8 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2Icon className="w-3.5 h-3.5 mr-1.5" /> Clear Logs
              </Button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-discord-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit logs by action, actor, target channel, or keyword..."
            className="pl-9 bg-black/40 text-xs text-white placeholder:text-slate-500 border-white/10"
          />
        </div>
      </div>

      {/* Audit Logs Feed */}
      <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-5 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-[#1E1F22] pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlertIcon className="w-4 h-4 text-discord-blurple" /> Event History ({logs.length})
          </h3>
          <span className="text-xs text-discord-text-muted">Showing latest events first</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-discord-text-muted gap-2">
            <RefreshCwIcon className="w-6 h-6 animate-spin text-discord-blurple" />
            <p className="text-xs">Loading audit events...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-discord-text-muted gap-2">
            <ClockIcon className="w-10 h-10 opacity-20" />
            <p className="text-sm">No audit logs found.</p>
            <p className="text-xs text-slate-500">Events will appear here as actions are executed.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-white/5 bg-[#1E1F22]/70 p-3.5 transition-colors hover:border-white/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-[240px]">
                      <div className="flex items-center flex-wrap gap-2">
                        {getCategoryBadge(log.category)}
                        <span className="font-bold text-xs text-white">{log.action}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">{log.details}</p>
                    </div>

                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div className="space-y-0.5 text-right">
                        <span className="flex items-center gap-1 text-[11px] text-discord-text-muted justify-end">
                          <UserIcon className="w-3 h-3 text-slate-400" /> {log.actor}
                        </span>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>

                      {hasMetadata && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="rounded p-1 text-discord-text-muted hover:bg-white/10 hover:text-white transition"
                          title="Toggle Metadata"
                        >
                          {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata inspector */}
                  {isExpanded && hasMetadata && (
                    <div className="mt-3 border-t border-white/5 pt-2.5">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Metadata Details:
                      </p>
                      <pre className="rounded bg-black/60 p-2.5 text-[11px] font-mono text-emerald-400 overflow-x-auto border border-white/5">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

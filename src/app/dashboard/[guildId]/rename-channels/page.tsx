"use client";

import { use, useEffect, useState, useMemo } from "react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDiscordChannels, Channel, GUILD_RESOURCE_REFRESH_EVENT } from "@/components/ui/discord-selects";
import {
  PenLineIcon,
  SearchIcon,
  RefreshCcwIcon,
  PlayIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  XIcon,
  HashIcon,
  Volume2Icon,
  FolderIcon,
  MessageSquareIcon,
  Loader2Icon,
} from "lucide-react";

type RenameState = "unchanged" | "modified" | "pending" | "processing" | "success" | "rate-limited" | "error";

interface ChannelStatus {
  state: RenameState;
  errorMsg?: string;
}

export default function ChannelRenamerPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();
  
  // Channels hooks
  const { channels, loading, errorMsg } = useDiscordChannels(guildId);
  
  // Local state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [cooldown, setCooldown] = useState<number>(5);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState<number>(-1);
  const [countdown, setCountdown] = useState<number>(0);
  const [statuses, setStatuses] = useState<Record<string, ChannelStatus>>({});

  // Helper to determine channel icons
  const getChannelIcon = (type: number) => {
    switch (type) {
      case 2: // Voice
      case 13: // Stage
        return <Volume2Icon className="h-4 w-4 text-sky-400" />;
      case 4: // Category
        return <FolderIcon className="h-4 w-4 text-amber-400" />;
      case 15: // Forum
        return <MessageSquareIcon className="h-4 w-4 text-emerald-400" />;
      case 0: // Text
      case 5: // Announcement
      default:
        return <HashIcon className="h-4 w-4 text-slate-400" />;
    }
  };

  // Filter channels
  const filteredChannels = useMemo(() => {
    if (!channels) return [];
    return channels.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
      
      let matchesType = true;
      if (filterType === "text") {
        matchesType = c.type === 0 || c.type === 5 || c.type === 15;
      } else if (filterType === "voice") {
        matchesType = c.type === 2 || c.type === 13;
      } else if (filterType === "category") {
        matchesType = c.type === 4;
      }
      
      return matchesSearch && matchesType;
    });
  }, [channels, search, filterType]);

  // Track modified count
  const modifiedChannels = useMemo(() => {
    return (channels || []).filter((c) => {
      const editedName = edits[c.id];
      return editedName !== undefined && editedName !== c.name && editedName.trim() !== "";
    });
  }, [channels, edits]);

  // Handle name edits
  const handleEdit = (channelId: string, newName: string) => {
    if (running) return;
    setEdits((prev) => ({
      ...prev,
      [channelId]: newName,
    }));
  };

  // Revert single channel edit
  const handleResetChannel = (channelId: string) => {
    if (running) return;
    setEdits((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
  };

  // Revert all edits
  const handleResetAll = () => {
    if (running) return;
    setEdits({});
    setStatuses({});
    toast("All modifications cleared.");
  };

  // Delay helper that also updates countdown state
  const waitWithCountdown = async (seconds: number, signal: AbortSignal) => {
    setCountdown(seconds);
    for (let i = seconds; i > 0; i--) {
      if (signal.aborted) return;
      setCountdown(i);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setCountdown(0);
  };

  // Sequential rename queue runner
  const handleRename = async () => {
    if (running) return;
    if (modifiedChannels.length === 0) {
      toast("No modified channels to rename.", "error");
      return;
    }

    setRunning(true);
    
    // Set all modified channels to pending status
    const initialStatuses: Record<string, ChannelStatus> = {};
    modifiedChannels.forEach((c) => {
      initialStatuses[c.id] = { state: "pending" };
    });
    setStatuses(initialStatuses);

    // Keep an abort controller if we want to cancel the queue later (can add cancel button if needed)
    const abortController = new AbortController();

    try {
      for (let i = 0; i < modifiedChannels.length; i++) {
        const channel = modifiedChannels[i];
        setCurrentIdx(i);

        // Set state to processing
        setStatuses((prev) => ({
          ...prev,
          [channel.id]: { state: "processing" },
        }));

        const newName = edits[channel.id];

        try {
          // Perform the API call to backend PATCH endpoint
          await fetchApi(`/guilds/${guildId}/channels/${channel.id}`, undefined, {
            method: "PATCH",
            body: JSON.stringify({ name: newName }),
          });

          // Set status to success
          setStatuses((prev) => ({
            ...prev,
            [channel.id]: { state: "success" },
          }));

          // Remove channel from edits map since it's successfully updated
          setEdits((prev) => {
            const next = { ...prev };
            delete next[channel.id];
            return next;
          });
        } catch (err: any) {
          const isRateLimit = err?.status === 429;
          const errorMsg = err?.message || "Failed to rename channel";
          
          setStatuses((prev) => ({
            ...prev,
            [channel.id]: {
              state: isRateLimit ? "rate-limited" : "error",
              errorMsg,
            },
          }));

          toast(`Error renaming ${channel.name}: ${errorMsg}`, "error");
          
          // Stop queue execution on critical errors (like permission issues)
          if (!isRateLimit) {
            toast("Rename batch paused due to error. Please check permissions and try again.", "error");
            break;
          }
        }

        // If there's another channel in queue, wait for cooldown
        if (i < modifiedChannels.length - 1) {
          await waitWithCountdown(cooldown, abortController.signal);
        }
      }
      
      // Dispatch refresh event to update resources globally
      window.dispatchEvent(new CustomEvent(GUILD_RESOURCE_REFRESH_EVENT));
      toast("Channel rename process finished.");
    } catch (e: any) {
      toast(`An unexpected error occurred: ${e.message}`, "error");
    } finally {
      setRunning(false);
      setCurrentIdx(-1);
      setCountdown(0);
    }
  };

  // Determine inline status badge
  const renderStatusBadge = (channel: Channel) => {
    const isChanModified = edits[channel.id] !== undefined && edits[channel.id] !== channel.name;
    const status = statuses[channel.id];

    if (!isChanModified && !status) return null;

    let state: RenameState = "modified";
    let errorMsg = "";

    if (status) {
      state = status.state;
      errorMsg = status.errorMsg || "";
    }

    switch (state) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
            Pending
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
            <Loader2Icon className="h-3 w-3 animate-spin text-blue-400" />
            Renaming...
          </span>
        );
      case "success":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
            <CheckCircle2Icon className="h-3.5 w-3.5 text-green-400" />
            Saved
          </span>
        );
      case "rate-limited":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400" title={errorMsg}>
            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-400" />
            Rate Limited
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400" title={errorMsg}>
            <XCircleIcon className="h-3.5 w-3.5 text-rose-400" />
            Failed
          </span>
        );
      case "modified":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
            Modified
          </span>
        );
    }
  };

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={PenLineIcon}
        title="Channel Renamer"
        subtitle="Batch rename multiple Discord channels from one clean dashboard. Renames run sequentially with a protective cooldown to automatically handle Discord rate limits."
        stats={[
          { label: "Total Channels", value: loading ? "..." : channels.length },
          { label: "Modified", value: modifiedChannels.length },
          { label: "Cooldown", value: `${cooldown}s` },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {modifiedChannels.length > 0 && !running && (
              <Button variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300" onClick={handleResetAll}>
                <XIcon className="mr-2 h-4 w-4" />
                Discard All
              </Button>
            )}
            <Button variant="discord" onClick={handleRename} disabled={running || modifiedChannels.length === 0}>
              {running ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Renaming... ({currentIdx + 1}/{modifiedChannels.length})
                </>
              ) : (
                <>
                  <PlayIcon className="mr-2 h-4 w-4" />
                  Approve & Rename ({modifiedChannels.length})
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Progress queue section */}
      {running && (
        <div className="w-full rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-blue-400 flex items-center gap-2">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Batch renaming in progress
            </span>
            <span className="text-xs text-slate-400">
              Renamed {currentIdx} of {modifiedChannels.length} channels
            </span>
          </div>
          
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(currentIdx / modifiedChannels.length) * 100}%` }}
            ></div>
          </div>

          {countdown > 0 && (
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
              Waiting {countdown} seconds cooldown before next rename...
            </div>
          )}
        </div>
      )}

      {/* Settings & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-white/10 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row flex-1">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              disabled={running}
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/14 bg-[rgba(24,24,27,0.92)] px-3 text-sm outline-none transition focus:border-white/30 text-discord-text"
              disabled={running}
            >
              <option value="all">All Types</option>
              <option value="text">Text Channels</option>
              <option value="voice">Voice Channels</option>
              <option value="category">Categories</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full md:w-44">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cooldown (seconds)</span>
          <Input
            type="number"
            min={1}
            max={60}
            value={cooldown}
            onChange={(e) => setCooldown(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={running}
            className="w-full"
          />
        </div>
      </div>

      {/* Channels List */}
      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2Icon className="h-8 w-8 animate-spin mb-2" />
            <p className="text-sm">Loading channels from Discord...</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center py-12 text-rose-400 bg-rose-500/5 rounded-2xl border border-rose-500/10">
            <XCircleIcon className="h-8 w-8 mb-2" />
            <p className="text-sm">{errorMsg}</p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">No channels match your filters.</p>
          </div>
        ) : (
          filteredChannels.map((channel) => {
            const isChanModified = edits[channel.id] !== undefined && edits[channel.id] !== channel.name;
            const currentVal = edits[channel.id] ?? channel.name;

            return (
              <div
                key={channel.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                  isChanModified
                    ? "bg-indigo-500/5 border-indigo-500/20"
                    : "bg-black/20 border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                    {getChannelIcon(channel.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {channel.name}
                      </span>
                      {renderStatusBadge(channel)}
                    </div>
                    {isChanModified && (
                      <span className="text-[10px] text-slate-400 truncate block">
                        Original: {channel.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Input
                    value={currentVal}
                    onChange={(e) => handleEdit(channel.id, e.target.value)}
                    disabled={running}
                    className="w-full sm:w-60 bg-black/40 text-sm border-white/10 focus:border-indigo-500/50"
                    placeholder="New name..."
                  />

                  {isChanModified && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl"
                      onClick={() => handleResetChannel(channel.id)}
                      disabled={running}
                      title="Revert changes"
                    >
                      <RefreshCcwIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, CheckIcon, XIcon } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// Discord channel type constants
const CHANNEL_TYPES: Record<number, string> = {
  0: "text",
  2: "voice",
  4: "category",
  5: "announcement",
  13: "stage",
  15: "forum",
};

function useDropdownPortal(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, openUp ? spaceAbove - 8 : spaceBelow - 8);
      const panelHeight = Math.min(320, maxHeight);
      const proposedTop = openUp ? rect.top - panelHeight - 8 : rect.bottom + 8;
      const top = Math.max(8, Math.min(proposedTop, viewportHeight - panelHeight - 8));
      const width = Math.min(rect.width, viewportWidth - 16);
      const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));

      setPanelStyle({
        top,
        left,
        width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return { containerRef, portalReady, panelStyle };
}

interface Channel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
}

// How often the channel/role lists silently refetch in the background so newly
// created channels/roles on Discord show up without the user reloading the page.
const GUILD_RESOURCE_REFRESH_MS = 45000;

/** Shared fetch + background-refresh for a guild's channel list. Every ChannelSelect
 * / ChannelMultiSelect instance uses this, so "new channel shows up" is handled once,
 * globally, instead of per-page. */
function useDiscordChannels(guildId: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;

    const load = (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      fetchApi(`/guilds/${guildId}/channels`)
        .then((data: Channel[]) => {
          if (cancelled) return;
          setChannels(data || []);
          setErrorMsg(null);
        })
        .catch((err) => {
          if (cancelled || !isInitial) return;
          setErrorMsg(err.message || "Failed to load channels");
        })
        .finally(() => {
          if (cancelled || !isInitial) return;
          setLoading(false);
        });
    };

    load(true);
    const timer = window.setInterval(() => load(false), GUILD_RESOURCE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guildId]);

  return { channels, loading, errorMsg };
}

/** Shared fetch + background-refresh for a guild's role list (see useDiscordChannels). */
function useDiscordRoles(guildId: string) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;

    const load = (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      fetchApi(`/guilds/${guildId}/roles`)
        .then((data: Role[]) => {
          if (cancelled) return;
          setRoles(data || []);
          setErrorMsg(null);
        })
        .catch((err) => {
          if (cancelled || !isInitial) return;
          setErrorMsg(err.message || "Failed to load roles");
        })
        .finally(() => {
          if (cancelled || !isInitial) return;
          setLoading(false);
        });
    };

    load(true);
    const timer = window.setInterval(() => load(false), GUILD_RESOURCE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guildId]);

  return { roles, loading, errorMsg };
}

interface ChannelSelectProps {
  guildId: string;
  value: string;
  onChange: (id: string) => void;
  onChannelSelect?: (channel: Channel) => void;
  /** Filter to specific channel types. Default: text + announcement channels (0, 5) */
  types?: number[];
  placeholder?: string;
  className?: string;
  includeCategories?: boolean;
}

export function ChannelSelect({
  guildId,
  value,
  onChange,
  onChannelSelect,
  types = [0, 5],
  placeholder = "Select a channel...",
  className,
  includeCategories = false,
}: ChannelSelectProps) {
  const { channels, loading, errorMsg } = useDiscordChannels(guildId);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { containerRef, portalReady, panelStyle } = useDropdownPortal(isOpen);

  // If includeCategories is true, allow categories (type 4) too
  const allowedTypes = includeCategories ? [...types, 4] : types;
  const filtered = channels.filter((c) => allowedTypes.includes(c.type));

  const iconFor = (type: number) => {
    if (type === 0) return "# ";
    if (type === 2) return "🔊 ";
    if (type === 4) return "📁 ";
    if (type === 5) return "📢 ";
    if (type === 15) return "💬 ";
    return "# ";
  };

  const selectedChannel = filtered.find((c) => c.id === value);
  const searchableChannels = filtered.filter((channel) => {
    const channelName = channel.name.toLowerCase();
    const query = search.toLowerCase();
    return channelName.includes(query);
  });

  const selectChannel = (channel: Channel) => {
    onChange(channel.id);
    if (onChannelSelect) onChannelSelect(channel);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => !loading && !errorMsg && setIsOpen(!isOpen)}
        disabled={loading || !!errorMsg}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-white/14 bg-[rgba(24,24,27,0.92)] px-3 py-2 text-sm text-discord-text transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate text-left">
          {loading
            ? "Loading channels..."
            : errorMsg
              ? `Error: ${errorMsg}`
              : selectedChannel
                ? `${iconFor(selectedChannel.type)}${selectedChannel.name}`
                : placeholder}
        </span>
        <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 text-[#8b90a0]" />
      </button>

      {isOpen && portalReady && panelStyle &&
        createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: 10000 }} onClick={() => setIsOpen(false)} />
            <div
              className="flex flex-col overflow-hidden rounded-xl border border-[#1E1F22] bg-[#1f2024] shadow-2xl"
              style={{
                position: "fixed",
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
                zIndex: 10001,
              }}
            >
              <div className="border-b border-[#1E1F22] p-2">
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-[#2a2b31] bg-[#141417] px-3 py-1.5 text-sm text-white placeholder-[#8b90a0] transition-colors focus:border-white/35 focus:outline-none"
                />
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto py-1.5">
                {searchableChannels.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-[#8b90a0]">No channels found</div>
                ) : (
                  searchableChannels.map((channel) => {
                    const selected = value === channel.id;
                    return (
                      <button
                        type="button"
                        key={channel.id}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[#383A40]",
                          selected && "bg-[#383A40]/40"
                        )}
                        onClick={() => selectChannel(channel)}
                      >
                        <div className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                          selected ? "border-[#a3a7b0] bg-[#a3a7b0]" : "border-[#404249] bg-transparent"
                        )}>
                          {selected && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <span className={cn("truncate font-medium", selected ? "text-white" : "text-[#B5BAC1]")}>
                          {iconFor(channel.type)}{channel.name}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}


interface RoleSelectProps {
  guildId: string;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function RoleSelect({
  guildId,
  value,
  onChange,
  placeholder = "Select a role...",
  className,
}: RoleSelectProps) {
  const { roles, loading, errorMsg } = useDiscordRoles(guildId);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { containerRef, portalReady, panelStyle } = useDropdownPortal(isOpen);

  const hexColor = (color: number) =>
    color ? `#${color.toString(16).padStart(6, "0")}` : "#99AAB5";

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedRole = roles.find((role) => role.id === value);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => !loading && !errorMsg && setIsOpen(!isOpen)}
        disabled={loading || !!errorMsg}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-white/14 bg-[rgba(24,24,27,0.92)] px-3 py-2 text-sm text-discord-text transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate text-left">
          {loading
            ? "Loading roles..."
            : errorMsg
              ? `Error: ${errorMsg}`
              : selectedRole
                ? `@${selectedRole.name}`
                : placeholder}
        </span>
        <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 text-[#8b90a0]" />
      </button>

      {isOpen && portalReady && panelStyle &&
        createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: 10000 }} onClick={() => setIsOpen(false)} />
            <div
              className="flex flex-col overflow-hidden rounded-xl border border-[#1E1F22] bg-[#1f2024] shadow-2xl"
              style={{
                position: "fixed",
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
                zIndex: 10001,
              }}
            >
              <div className="border-b border-[#1E1F22] p-2">
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-[#2a2b31] bg-[#141417] px-3 py-1.5 text-sm text-white placeholder-[#8b90a0] transition-colors focus:border-white/35 focus:outline-none"
                />
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto py-1.5">
                {filteredRoles.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-[#8b90a0]">No roles found</div>
                ) : (
                  filteredRoles.map((role) => {
                    const selected = value === role.id;
                    return (
                      <button
                        type="button"
                        key={role.id}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[#383A40]",
                          selected && "bg-[#383A40]/40"
                        )}
                        onClick={() => {
                          onChange(role.id);
                          setIsOpen(false);
                          setSearch("");
                        }}
                      >
                        <div className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                          selected ? "border-[#a3a7b0] bg-[#a3a7b0]" : "border-[#404249] bg-transparent"
                        )}>
                          {selected && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hexColor(role.color) }} />
                        <span className={cn("truncate font-medium", selected ? "text-white" : "text-[#B5BAC1]")}>@{role.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}


/** Multi-select for roles — stores as array of IDs */
interface RoleMultiSelectProps {
  guildId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function RoleMultiSelect({ guildId, value, onChange, className }: RoleMultiSelectProps) {
  const { roles, loading, errorMsg } = useDiscordRoles(guildId);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { containerRef, portalReady, panelStyle } = useDropdownPortal(isOpen);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const hexColor = (color: number) =>
    color ? `#${color.toString(16).padStart(6, "0")}` : "#99AAB5";

  if (loading) {
    return <div className="text-sm text-discord-text-muted">Loading roles...</div>;
  }
  
  if (errorMsg) {
    return <div className="text-sm text-red-400">Error: {errorMsg}</div>;
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div 
        className="min-h-[40px] w-full cursor-pointer rounded-md border border-discord-darkest bg-discord-darkest px-2 py-1.5 flex items-center justify-between shadow-sm transition-colors hover:border-white/20"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 items-center">
          {value.length === 0 && <span className="text-sm text-[#8b90a0] px-1 py-0.5">Select allowed roles...</span>}
          {value.map(id => {
            const role = roles.find(r => r.id === id);
            if (!role) return null;
            return (
              <div 
                key={id} 
                className="flex items-center gap-1.5 rounded-md bg-[#2B2D31] px-2 py-0.5 text-[11px] font-medium text-white border border-[#1E1F22] shadow-sm hover:bg-[#383A40] transition-colors"
                onClick={(e) => { e.stopPropagation(); toggle(id); }}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hexColor(role.color) }} />
                <span className="max-w-[120px] truncate">{role.name}</span>
                <XIcon className="h-3 w-3 ml-0.5 text-[#8b90a0] hover:text-white shrink-0" />
              </div>
            );
          })}
        </div>
        <ChevronDownIcon className="h-4 w-4 text-[#8b90a0] shrink-0 ml-2" />
      </div>

      {isOpen && portalReady && panelStyle &&
        createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: 10000 }} onClick={() => setIsOpen(false)} />
            <div
              className="mt-2 flex max-h-56 flex-col overflow-hidden rounded-xl border border-[#1E1F22] bg-[#2B2D31] shadow-2xl"
              style={{
                position: "fixed",
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
                zIndex: 10001,
              }}
            >
              <div className="border-b border-[#1E1F22] p-2">
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-[#2a2b31] bg-[#141417] px-3 py-1.5 text-sm text-white placeholder-[#8b90a0] transition-colors focus:border-white/35 focus:outline-none"
                />
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto py-1.5">
                {roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-[#8b90a0]">No roles found</div>
                ) : (
                  roles
                    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
                    .map((role) => {
                      const selected = value.includes(role.id);
                      return (
                        <div
                          key={role.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[#383A40]",
                            selected && "bg-[#383A40]/40"
                          )}
                          onClick={() => toggle(role.id)}
                        >
                          <div className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                            selected ? "border-[#a3a7b0] bg-[#a3a7b0]" : "border-[#404249] bg-transparent"
                          )}>
                            {selected && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hexColor(role.color) }} />
                          <span className={cn("truncate font-medium", selected ? "text-white" : "text-[#B5BAC1]")}>
                            {role.name}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export interface ChannelMultiSelectProps {
  guildId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  types?: number[];
  includeCategories?: boolean;
  className?: string;
  placeholder?: string;
}

export function ChannelMultiSelect({ 
  guildId, value, onChange, className, types = [0, 5], includeCategories = false, placeholder = "Select channels..." 
}: ChannelMultiSelectProps) {
  const { channels, loading, errorMsg } = useDiscordChannels(guildId);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { containerRef, portalReady, panelStyle } = useDropdownPortal(isOpen);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const allowedTypes = includeCategories ? [...types, 4] : types;
  const filtered = channels.filter((c) => allowedTypes.includes(c.type));

  const iconFor = (type: number) => {
    if (type === 0) return "# ";
    if (type === 2) return "🔊 ";
    if (type === 4) return "📁 ";
    if (type === 5) return "📢 ";
    if (type === 15) return "💬 ";
    return "# ";
  };

  if (loading) {
    return <div className="text-sm text-discord-text-muted">Loading channels...</div>;
  }
  
  if (errorMsg) {
    return <div className="text-sm text-red-400">Error: {errorMsg}</div>;
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div 
        className="min-h-[40px] w-full cursor-pointer rounded-md border border-discord-darkest bg-discord-darkest px-2 py-1.5 flex flex-wrap items-center justify-between shadow-sm transition-colors hover:border-white/20"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 items-center">
          {value.length === 0 && <span className="text-sm text-[#8b90a0] px-1 py-0.5">{placeholder}</span>}
          {value.map(id => {
            const channel = channels.find(c => c.id === id);
            if (!channel) return null;
            return (
              <div 
                key={id} 
                className="flex items-center gap-1.5 rounded-md bg-[#2B2D31] px-2 py-0.5 text-[12px] font-medium text-white border border-[#1E1F22] shadow-sm hover:bg-[#383A40] transition-colors"
                onClick={(e) => { e.stopPropagation(); toggle(id); }}
              >
                <span className="truncate">{iconFor(channel.type)}{channel.name}</span>
                <XIcon className="h-3 w-3 ml-0.5 text-[#8b90a0] hover:text-white shrink-0" />
              </div>
            );
          })}
        </div>
        <ChevronDownIcon className="h-4 w-4 text-[#8b90a0] shrink-0 ml-2" />
      </div>

      {isOpen && portalReady && panelStyle &&
        createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: 10000 }} onClick={() => setIsOpen(false)} />
            <div
              className="mt-2 flex max-h-56 flex-col overflow-hidden rounded-xl border border-[#1E1F22] bg-[#2B2D31] shadow-2xl"
              style={{
                position: "fixed",
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
                zIndex: 10001,
              }}
            >
              <div className="border-b border-[#1E1F22] p-2">
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-[#2a2b31] bg-[#141417] px-3 py-1.5 text-sm text-white placeholder-[#8b90a0] transition-colors focus:border-white/35 focus:outline-none"
                />
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto py-1.5">
                {filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-[#8b90a0]">No channels found</div>
                ) : (
                  filtered
                    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
                    .map((channel) => {
                      const selected = value.includes(channel.id);
                      return (
                        <div
                          key={channel.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[#383A40]",
                            selected && "bg-[#383A40]/40"
                          )}
                          onClick={() => toggle(channel.id)}
                        >
                          <div className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                            selected ? "border-[#a3a7b0] bg-[#a3a7b0]" : "border-[#404249] bg-transparent"
                          )}>
                            {selected && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className={cn("truncate font-medium", selected ? "text-white" : "text-[#B5BAC1]")}>
                            {iconFor(channel.type)} {channel.name}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

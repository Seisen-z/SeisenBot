"use client";

import { useEffect, useState } from "react";
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

interface Channel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
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
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    fetchApi(`/guilds/${guildId}/channels`)
      .then((data: Channel[]) => {
        setChannels(data || []);
        setErrorMsg(null);
      })
      .catch((err) => setErrorMsg(err.message || "Failed to load channels"))
      .finally(() => setLoading(false));
  }, [guildId]);

  // If includeCategories is true, allow categories (type 4) too
  const allowedTypes = includeCategories ? [...types, 4] : types;
  const filtered = channels.filter((c) => allowedTypes.includes(c.type));

  // Group channels under their parent categories
  const categories = channels.filter((c) => c.type === 4);
  const grouped: { category: Channel | null; channels: Channel[] }[] = [];

  // Uncategorized channels first
  const uncategorized = filtered.filter((c) => !c.parent_id && c.type !== 4);
  if (uncategorized.length > 0) {
    grouped.push({ category: null, channels: uncategorized });
  }

  // Group by category
  categories.forEach((cat) => {
    const children = filtered.filter((c) => c.parent_id === cat.id);
    // If includeCategories, also add the category itself as selectable
    const categoryEntry = includeCategories ? [{ ...cat }] : [];
    if (children.length > 0 || categoryEntry.length > 0) {
      grouped.push({ category: cat, channels: [...categoryEntry, ...children] });
    }
  });

  const iconFor = (type: number) => {
    if (type === 0) return "# ";
    if (type === 2) return "🔊 ";
    if (type === 4) return "📁 ";
    if (type === 5) return "📢 ";
    if (type === 15) return "💬 ";
    return "# ";
  };

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        const selectedId = e.target.value;
        onChange(selectedId);
        if (onChannelSelect) {
          const channelObj = channels.find(c => c.id === selectedId);
          if (channelObj) onChannelSelect(channelObj);
        }
      }}
      disabled={loading || !!errorMsg}
      className={cn(
        "flex h-10 w-full rounded-md border border-discord-darkest bg-discord-darkest px-3 py-2 text-sm text-discord-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-blurple disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <option value="">{loading ? "Loading channels..." : errorMsg ? `Error: ${errorMsg}` : placeholder}</option>
      {grouped.map(({ category, channels: groupChans }) => (
        <optgroup
          key={category?.id ?? "uncategorized"}
          label={category ? `📁 ${category.name}` : "No Category"}
        >
          {groupChans.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {iconFor(ch.type)}{ch.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}


interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
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
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    fetchApi(`/guilds/${guildId}/roles`)
      .then((data: Role[]) => {
        setRoles(data || []);
        setErrorMsg(null);
      })
      .catch((err) => setErrorMsg(err.message || "Failed to load roles"))
      .finally(() => setLoading(false));
  }, [guildId]);

  const hexColor = (color: number) =>
    color ? `#${color.toString(16).padStart(6, "0")}` : "#99AAB5";

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading || !!errorMsg}
      className={cn(
        "flex h-10 w-full rounded-md border border-discord-darkest bg-discord-darkest px-3 py-2 text-sm text-discord-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-blurple disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <option value="">{loading ? "Loading roles..." : errorMsg ? `Error: ${errorMsg}` : placeholder}</option>
      {roles.map((role) => (
        <option key={role.id} value={role.id} style={{ color: hexColor(role.color) }}>
          @{role.name}
        </option>
      ))}
    </select>
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
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    fetchApi(`/guilds/${guildId}/roles`)
      .then((data: Role[]) => {
        setRoles(data || []);
        setErrorMsg(null);
      })
      .catch((err) => setErrorMsg(err.message || "Failed to load roles"))
      .finally(() => setLoading(false));
  }, [guildId]);

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
    <div className={cn("relative w-full", className)}>
      <div 
        className="min-h-[40px] w-full cursor-pointer rounded-md border border-discord-darkest bg-discord-darkest px-2 py-1.5 flex items-center justify-between shadow-sm transition-colors hover:border-[#1E1F22]"
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

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 z-50 w-full mt-2 max-h-56 overflow-hidden flex flex-col rounded-xl border border-[#1E1F22] bg-[#2B2D31] shadow-2xl">
            <div className="p-2 border-b border-[#1E1F22]">
              <input
                type="text"
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#1E1F22] rounded-md px-3 py-1.5 text-sm text-white placeholder-[#8b90a0] focus:outline-none focus:border-[#5865F2]/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 py-1.5">
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
                          "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#383A40] transition-colors",
                          selected && "bg-[#383A40]/40"
                        )}
                        onClick={() => toggle(role.id)}
                      >
                        <div className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors", 
                          selected ? "border-[#5865F2] bg-[#5865F2]" : "border-[#404249] bg-transparent"
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
        </>
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
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    fetchApi(`/guilds/${guildId}/channels`)
      .then((data: Channel[]) => {
        setChannels(data || []);
        setErrorMsg(null);
      })
      .catch((err) => setErrorMsg(err.message || "Failed to load channels"))
      .finally(() => setLoading(false));
  }, [guildId]);

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
    <div className={cn("relative w-full", className)}>
      <div 
        className="min-h-[40px] w-full cursor-pointer rounded-md border border-discord-darkest bg-discord-darkest px-2 py-1.5 flex flex-wrap items-center justify-between shadow-sm transition-colors hover:border-[#1E1F22]"
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

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 z-50 w-full mt-2 max-h-56 overflow-hidden flex flex-col rounded-xl border border-[#1E1F22] bg-[#2B2D31] shadow-2xl">
            <div className="p-2 border-b border-[#1E1F22]">
              <input
                type="text"
                placeholder="Search channels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#1E1F22] rounded-md px-3 py-1.5 text-sm text-white placeholder-[#8b90a0] focus:outline-none focus:border-[#5865F2]/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 py-1.5">
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
                          "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#383A40] transition-colors",
                          selected && "bg-[#383A40]/40"
                        )}
                        onClick={() => toggle(channel.id)}
                      >
                        <div className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors", 
                          selected ? "border-[#5865F2] bg-[#5865F2]" : "border-[#404249] bg-transparent"
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
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, use, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { RoleMultiSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import {
  ShieldCheckIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XIcon,
  CheckSquareIcon,
  SquareIcon,
} from "lucide-react";

const COMMAND_GROUPS: Record<string, { cmd: string; desc: string }[]> = {
  "Administration & Moderation": [
    { cmd: "ban", desc: "Ban a member from the server" },
    { cmd: "baninfo", desc: "View the profile of a banned user" },
    { cmd: "banlist", desc: "List all banned users in the server" },
    { cmd: "clear", desc: "Clear a specific number of messages" },
    { cmd: "kick", desc: "Kick a member from the server" },
    { cmd: "purge", desc: "Bulk delete messages in a channel (up to 1000)" },
    { cmd: "unban", desc: "Unban a user from the server by their ID" },
    { cmd: "invite", desc: "Get a permanent invite link for this server" },
    { cmd: "invitelist", desc: "List all active invites in the server" },
  ],
  "Access Control": [
    { cmd: "access list", desc: "List role access for locked commands" },
    { cmd: "access lock", desc: "Lock a command back to owner-only" },
    { cmd: "access remove", desc: "Remove a role from a locked command" },
    { cmd: "access role", desc: "Allow a role to use a locked command" },
  ],
  "AI Help Module": [
    { cmd: "ai_help instructions", desc: "Set system instructions for the AI" },
    { cmd: "ai_help list", desc: "Show current AI Help configuration" },
    { cmd: "ai_help model", desc: "Set the OpenRouter model to use" },
    { cmd: "ai_help setup", desc: "Configure AI monitored channels" },
    { cmd: "ai_help toggle", desc: "Enable or disable AI Help" },
  ],
  "Activity Rewards": [
    { cmd: "activity leaderboard", desc: "Show top activity leaderboard for this server" },
    { cmd: "activity me", desc: "Show your activity stats in this server" },
    { cmd: "activity test", desc: "Test the activity command (debug)" },
  ],
  "Utility / Access": [
    { cmd: "command", desc: "List commands with role-based access configured" },
  ],
  "Announcements": [
    { cmd: "announce", desc: "Send an announcement via a form" },
    { cmd: "announce_draft delete", desc: "Delete a saved announcement draft" },
    { cmd: "announce_draft list", desc: "List all saved announcement drafts" },
    { cmd: "announce_draft save", desc: "Save an announcement draft" },
  ],
  "Auto Replies": [
    { cmd: "autoreply add", desc: "Add an auto reply rule" },
    { cmd: "autoreply edit", desc: "Edit an existing auto reply rule" },
    { cmd: "autoreply edittargets", desc: "Change rule target channels/categories" },
    { cmd: "autoreply list", desc: "List all active auto reply rules" },
    { cmd: "autoreply remove", desc: "Remove an auto reply rule" },
    { cmd: "autoreply setdelay", desc: "Set or clear auto-delete delay" },
  ],
  "Boosting Options": [
    { cmd: "boost addrole", desc: "Add a role to be mentioned on boosts" },
    { cmd: "boost category", desc: "Set category for boost claim channels" },
    { cmd: "boost config", desc: "Show current server boost config" },
    { cmd: "boost removerole", desc: "Remove a mentioned boost role" },
    { cmd: "boost setlog", desc: "Set channel for server boost logs" },
    { cmd: "boost test", desc: "Test the boost webhook and log system" },
  ],
  "Giveaways": [
    { cmd: "giveaway create", desc: "Create a new reaction-based giveaway" },
    { cmd: "giveaway delete", desc: "Delete an ended giveaway" },
    { cmd: "giveaway end", desc: "End an active giveaway and announce winners" },
    { cmd: "giveaway reroll", desc: "Pick new winner(s) from giveaway entrants" },
    { cmd: "giveaway list", desc: "List recent giveaway IDs and status" },
  ],
  "Member Counter": [
    { cmd: "membercounter create", desc: "Create a realtime member counter channel" },
    { cmd: "membercounter configure", desc: "Configure an existing channel as member counter" },
    { cmd: "membercounter remove", desc: "Remove the member counter for this server" },
    { cmd: "membercounter status", desc: "Show current member counter configuration" },
  ],
  "Polls": [
    { cmd: "poll create", desc: "Start a native Discord poll with live results" },
    { cmd: "poll end", desc: "Manually end a native Discord poll" },
  ],
  "Reaction Roles": [
    { cmd: "reaction_roles create", desc: "Create a new reaction role message" },
    { cmd: "reaction_roles add_role", desc: "Add a role option to an existing reaction role message" },
    { cmd: "reaction_roles remove_role", desc: "Remove a role option from a reaction role message" },
    { cmd: "reaction_roles list", desc: "List all reaction role messages in this server" },
  ],
  "Select Menu Roles": [
    { cmd: "select_menu_roles create", desc: "Create a new select menu role message" },
  ],
  "Roblox Integration": [
    { cmd: "roblox list", desc: "List active monitored Roblox games" },
    { cmd: "roblox remove", desc: "Stop monitoring a Roblox game" },
    { cmd: "roblox setup", desc: "Monitor a game and ping on updates" },
    { cmd: "roblox status", desc: "Show current Roblox monitor configs" },
    { cmd: "roblox test", desc: "Send a test update notification" },
  ],
  "Role Management": [
    { cmd: "role add", desc: "Add a role to a member" },
    { cmd: "role all", desc: "Give a role to every member" },
    { cmd: "role remove", desc: "Remove a role from a member" },
  ],
  "Sticky Messages": [
    { cmd: "sticky message", desc: "Set a sticky message for the channel" },
    { cmd: "sticky remove", desc: "Remove the sticky message" },
  ],
  "Ticketing": [
    { cmd: "ticket close", desc: "Close the current ticket channel" },
    { cmd: "ticket setup", desc: "Create a ticket panel in a channel" },
  ],
  "Vouch System": [
    { cmd: "vouch", desc: "Create a new vouch for this server" },
    { cmd: "vouch_setup", desc: "Set the channel where vouches post" },
  ],
  "Fun & Community Commands": [
    { cmd: "8ball", desc: "Ask the magic 8-ball a question" },
    { cmd: "coinflip", desc: "Flip a coin (heads or tails)" },
    { cmd: "dice", desc: "Roll a dice (1-6)" },
    { cmd: "joke", desc: "Get a random joke" },
    { cmd: "meme", desc: "Get a random meme" },
    { cmd: "quote", desc: "Get an inspirational quote" },
    { cmd: "roast", desc: "Get playfully roasted by the bot" },
    { cmd: "compliment", desc: "Receive a nice compliment" },
    { cmd: "fact", desc: "Learn a random fun fact" },
    { cmd: "riddle", desc: "Get a riddle to solve" },
  ],
  "General / Miscellaneous": [
    { cmd: "command", desc: "List commands with role-based access configured" },
    { cmd: "help", desc: "Show all available commands" },
    { cmd: "ping", desc: "Check bot latency and response time" },
    { cmd: "hello", desc: "Get a friendly greeting from the bot" },
    { cmd: "say", desc: "Make the bot say something" },
    { cmd: "roll", desc: "Roll dice (e.g., 1d6, 2d20)" },
    { cmd: "userinfo", desc: "Display information about a user" },
    { cmd: "serverinfo", desc: "Display information about this server" },
    { cmd: "avatar", desc: "Display a user's avatar" },
  ],
};

// ─── Role pill colours (cycles through a small palette) ──────────────────────
const PILL_COLORS = [
  "bg-[#5865F2]/20 text-[#8b9bff] border-[#5865F2]/30",
  "bg-[#57F287]/15 text-[#57F287] border-[#57F287]/30",
  "bg-[#FEE75C]/15 text-[#FEE75C] border-[#FEE75C]/30",
  "bg-[#EB459E]/15 text-[#EB459E] border-[#EB459E]/30",
  "bg-[#ED4245]/15 text-[#ED4245] border-[#ED4245]/30",
];

function RolePills({ roleIds, roleNames }: { roleIds: string[]; roleNames: Record<string, string> }) {
  if (roleIds.length === 0) return null;
  const shown = roleIds.slice(0, 3);
  const extra = roleIds.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((id, i) => (
        <span
          key={id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PILL_COLORS[i % PILL_COLORS.length]}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {roleNames[id] ?? "Unknown Role"}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-white/5 text-[#B5BAC1] border-white/10">
          +{extra} more
        </span>
      )}
    </div>
  );
}

export default function CommandAccessPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();

  const [commands, setCommands] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Role name cache so pills can show names not just IDs
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});

  // Search / filter
  const [search, setSearch] = useState("");

  // Collapsed categories (none collapsed by default)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Selection for bulk configure
  const [selectedCmds, setSelectedCmds] = useState<Set<string>>(new Set());
  const [bulkRoles, setBulkRoles] = useState<string[]>([]);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchApi(`/guilds/${guildId}/commands`)
      .then((data) => setCommands(data?.commands || {}))
      .catch(() => toast("Failed to load commands config", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/roles`)
      .then((data: any[]) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r) => { map[String(r.id)] = r.name; });
        setRoleNames(map);
      })
      .catch(() => {});
  }, [guildId]);

  // ── Persistence ─────────────────────────────────────────────────────────────
  const persistCommands = useCallback(async (nextCommands: Record<string, string[]>) => {
    const cleaned: Record<string, string[]> = {};
    for (const [cmd, roles] of Object.entries(nextCommands)) {
      if (roles?.length > 0) cleaned[cmd] = roles;
    }
    await fetchApi(`/guilds/${guildId}/commands`, undefined, {
      method: "PUT",
      body: JSON.stringify({ commands: cleaned }),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: commands,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistCommands,
    onError: (err: any) => toast(err?.message || "Auto-save failed", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistCommands(commands);
      toast("Command Config Saved!");
    } catch (e: any) {
      toast(e?.message || "Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Search filter ────────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMMAND_GROUPS;
    const result: Record<string, { cmd: string; desc: string }[]> = {};
    for (const [cat, list] of Object.entries(COMMAND_GROUPS)) {
      const filtered = list.filter(
        ({ cmd, desc }) => cmd.includes(q) || desc.toLowerCase().includes(q) || cat.toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[cat] = filtered;
    }
    return result;
  }, [search]);

  // ── Selection helpers ────────────────────────────────────────────────────────
  const toggleCmd = (cmd: string) => {
    setSelectedCmds((prev) => {
      const next = new Set(prev);
      if (next.has(cmd)) next.delete(cmd); else next.add(cmd);
      return next;
    });
  };

  const toggleCategory = (cmdList: { cmd: string }[]) => {
    const keys = cmdList.map((c) => c.cmd);
    const allSel = keys.every((k) => selectedCmds.has(k));
    setSelectedCmds((prev) => {
      const next = new Set(prev);
      allSel ? keys.forEach((k) => next.delete(k)) : keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const clearSelection = () => { setSelectedCmds(new Set()); setBulkRoles([]); };

  const applyBulkRoles = () => {
    setCommands((prev) => {
      const next = { ...prev };
      selectedCmds.forEach((cmd) => { next[cmd] = [...bulkRoles]; });
      return next;
    });
    toast(`Applied ${bulkRoles.length} role(s) to ${selectedCmds.size} command(s).`);
    clearSelection();
  };

  const clearSelectedRoles = () => {
    setCommands((prev) => {
      const next = { ...prev };
      selectedCmds.forEach((cmd) => { next[cmd] = []; });
      return next;
    });
    toast(`Cleared roles from ${selectedCmds.size} command(s).`);
    clearSelection();
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalCommands = Object.values(COMMAND_GROUPS).reduce((s, l) => s + l.length, 0);
  const restrictedCommands = Object.values(commands).filter((r) => r?.length > 0).length;
  const totalRolesLinked = Object.values(commands).reduce((s, r) => s + (r?.length || 0), 0);
  const hasSelection = selectedCmds.size > 0;

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-6 pb-40">
      <DashboardPageHero
        icon={ShieldCheckIcon}
        title="Command Access Control"
        subtitle="Select one or more commands and assign roles to them all at once."
        stats={[
          { label: "Command Groups", value: Object.keys(COMMAND_GROUPS).length },
          { label: "Total Commands", value: totalCommands },
          { label: "Restricted", value: restrictedCommands },
          { label: "Role Links", value: totalRolesLinked },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {Date.now() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#5865F2] hover:bg-[#4752C4] shadow-md transition-all"
            >
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </div>
        }
      />

      {/* Search bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280] pointer-events-none" />
        <input
          type="text"
          placeholder="Search commands…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[#2B2D31] bg-[#141518] pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#6b7280] outline-none focus:border-[#5865F2]/60 focus:ring-1 focus:ring-[#5865F2]/30 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-white transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hint when nothing selected */}
      {!hasSelection && (
        <p className="text-xs text-[#6b7280] -mt-2">
          Click any command row to select it. Select multiple, then assign roles from the bar that appears at the bottom.
        </p>
      )}

      {/* Command list */}
      <div className="flex flex-col gap-2">
        {Object.entries(filteredGroups).map(([category, cmdList]) => {
          const isCollapsed = collapsed.has(category);
          const allSel = cmdList.every((c) => selectedCmds.has(c.cmd));
          const someSel = cmdList.some((c) => selectedCmds.has(c.cmd));
          const catRestricted = cmdList.filter((c) => (commands[c.cmd]?.length || 0) > 0).length;

          return (
            <div key={category} className="rounded-xl border border-[#1E1F22] overflow-hidden">
              {/* Category header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-[#141518] border-b border-[#1E1F22]">
                {/* Category select-all checkbox */}
                <button
                  onClick={() => toggleCategory(cmdList)}
                  className="shrink-0 text-[#4B4D55] hover:text-[#5865F2] transition-colors"
                  title={allSel ? "Deselect all in category" : "Select all in category"}
                >
                  {allSel ? (
                    <CheckSquareIcon className="w-4 h-4 text-[#5865F2]" />
                  ) : someSel ? (
                    <CheckSquareIcon className="w-4 h-4 text-[#5865F2]/50" />
                  ) : (
                    <SquareIcon className="w-4 h-4" />
                  )}
                </button>

                {/* Collapse toggle */}
                <button
                  className="flex-1 flex items-center gap-2 text-left"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(category)) next.delete(category); else next.add(category);
                      return next;
                    })
                  }
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="w-4 h-4 text-[#6b7280] shrink-0" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4 text-[#6b7280] shrink-0" />
                  )}
                  <span className="text-sm font-bold text-white">{category}</span>
                  <span className="text-xs text-[#6b7280] font-normal">
                    {cmdList.length} command{cmdList.length !== 1 ? "s" : ""}
                    {catRestricted > 0 && (
                      <span className="ml-2 text-[#5865F2]">{catRestricted} restricted</span>
                    )}
                  </span>
                </button>
              </div>

              {/* Command rows */}
              {!isCollapsed && (
                <div className="divide-y divide-[#1E1F22]">
                  {cmdList.map(({ cmd, desc }) => {
                    const isSelected = selectedCmds.has(cmd);
                    const roleIds = commands[cmd] || [];
                    const hasRoles = roleIds.length > 0;

                    return (
                      <div
                        key={cmd}
                        onClick={() => toggleCmd(cmd)}
                        className={`flex items-center gap-4 px-4 py-3 cursor-pointer select-none transition-colors ${
                          isSelected
                            ? "bg-[#5865F2]/[0.12]"
                            : "bg-[#1a1b1e] hover:bg-[#1f2125]"
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-[#5865F2] border-[#5865F2]"
                              : "border-[#3C3F45] bg-transparent"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                              <path
                                d="M1.5 5l2.5 2.5 4.5-4.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Command name */}
                        <div className="w-48 shrink-0">
                          <span className={`text-sm font-semibold font-mono ${isSelected ? "text-white" : hasRoles ? "text-white" : "text-[#B5BAC1]"}`}>
                            <span className="text-[#5865F2]">/</span>{cmd}
                          </span>
                        </div>

                        {/* Description */}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[#6b7280] truncate block">{desc}</span>
                        </div>

                        {/* Role pills */}
                        <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {hasRoles ? (
                            <RolePills roleIds={roleIds} roleNames={roleNames} />
                          ) : (
                            <span className="text-[11px] text-[#4B4D55]">No restriction</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(filteredGroups).length === 0 && (
          <div className="py-16 text-center text-[#6b7280] text-sm">
            No commands match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* Sticky bulk action bar */}
      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-[#5865F2]/40 bg-[#1a1b1e]/95 backdrop-blur-md shadow-2xl p-4 flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#5865F2] text-white text-xs font-bold">
                  {selectedCmds.size}
                </span>
                <span className="text-sm font-semibold text-white">
                  command{selectedCmds.size !== 1 ? "s" : ""} selected
                </span>
                <span className="text-xs text-[#6b7280]">— assign the same roles to all of them</span>
              </div>
              <button
                onClick={clearSelection}
                className="text-[#6b7280] hover:text-white transition-colors"
                title="Deselect all"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Role picker */}
            <div onClick={(e) => e.stopPropagation()}>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
                Allowed Roles
              </label>
              <RoleMultiSelect guildId={guildId} value={bulkRoles} onChange={setBulkRoles} />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                onClick={applyBulkRoles}
                className="flex-1 bg-[#5865F2] hover:bg-[#4752C4] text-sm font-semibold"
              >
                Apply to {selectedCmds.size} command{selectedCmds.size !== 1 ? "s" : ""}
              </Button>
              <Button
                onClick={clearSelectedRoles}
                className="bg-[#ED4245]/15 hover:bg-[#ED4245]/25 border border-[#ED4245]/40 text-[#ED4245] text-sm px-4"
                title="Remove all roles from selected commands"
              >
                Clear Roles
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

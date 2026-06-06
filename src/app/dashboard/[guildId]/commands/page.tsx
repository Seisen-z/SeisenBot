"use client";

import { useCallback, useEffect, useState, use, useRef } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { RoleMultiSelect } from "@/components/ui/discord-selects";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { ShieldCheckIcon, Layers2Icon, XIcon, CheckSquareIcon, SquareIcon } from "lucide-react";

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
    { cmd: "invitelist", desc: "List all active invites in the server" }
  ],
  "Access Control": [
    { cmd: "access list", desc: "List role access for locked commands" },
    { cmd: "access lock", desc: "Lock a command back to owner-only" },
    { cmd: "access remove", desc: "Remove a role from a locked command" },
    { cmd: "access role", desc: "Allow a role to use a locked command" }
  ],
  "AI Help Module": [
    { cmd: "ai_help instructions", desc: "Set system instructions for the AI" },
    { cmd: "ai_help list", desc: "Show current AI Help configuration" },
    { cmd: "ai_help model", desc: "Set the OpenRouter model to use" },
    { cmd: "ai_help setup", desc: "Configure AI monitored channels" },
    { cmd: "ai_help toggle", desc: "Enable or disable AI Help" }
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
    { cmd: "announce_draft save", desc: "Save an announcement draft" }
  ],
  "Auto Replies": [
    { cmd: "autoreply add", desc: "Add an auto reply rule" },
    { cmd: "autoreply edit", desc: "Edit an existing auto reply rule" },
    { cmd: "autoreply edittargets", desc: "Change rule target channels/categories" },
    { cmd: "autoreply list", desc: "List all active auto reply rules" },
    { cmd: "autoreply remove", desc: "Remove an auto reply rule" },
    { cmd: "autoreply setdelay", desc: "Set or clear auto-delete delay" }
  ],
  "Boosting Options": [
    { cmd: "boost addrole", desc: "Add a role to be mentioned on boosts" },
    { cmd: "boost category", desc: "Set category for boost claim channels" },
    { cmd: "boost config", desc: "Show current server boost config" },
    { cmd: "boost removerole", desc: "Remove a mentioned boost role" },
    { cmd: "boost setlog", desc: "Set channel for server boost logs" },
    { cmd: "boost test", desc: "Test the boost webhook and log system" }
  ],
  "Giveaways": [
    { cmd: "giveaway create", desc: "Create a new reaction-based giveaway" },
    { cmd: "giveaway delete", desc: "Delete an ended giveaway" },
    { cmd: "giveaway end", desc: "End an active giveaway and announce winners" },
    { cmd: "giveaway reroll", desc: "Pick new winner(s) from giveaway entrants" },
    { cmd: "giveaway list", desc: "List recent giveaway IDs and status" }
  ],
  "Member Counter": [
    { cmd: "membercounter create", desc: "Create a realtime member counter channel" },
    { cmd: "membercounter configure", desc: "Configure an existing channel as member counter" },
    { cmd: "membercounter remove", desc: "Remove the member counter for this server" },
    { cmd: "membercounter status", desc: "Show current member counter configuration" }
  ],
  "Polls": [
    { cmd: "poll create", desc: "Start a native Discord poll with live results" },
    { cmd: "poll end", desc: "Manually end a native Discord poll" }
  ],
  "Reaction Roles": [
    { cmd: "reaction_roles create", desc: "Create a new reaction role message" },
    { cmd: "reaction_roles add_role", desc: "Add a role option to an existing reaction role message" },
    { cmd: "reaction_roles remove_role", desc: "Remove a role option from a reaction role message" },
    { cmd: "reaction_roles list", desc: "List all reaction role messages in this server" }
  ],
  "Select Menu Roles": [
    { cmd: "select_menu_roles create", desc: "Create a new select menu role message" }
  ],
  "Roblox Integration": [
    { cmd: "roblox list", desc: "List active monitored Roblox games" },
    { cmd: "roblox remove", desc: "Stop monitoring a Roblox game" },
    { cmd: "roblox setup", desc: "Monitor a game and ping on updates" },
    { cmd: "roblox status", desc: "Show current Roblox monitor configs" },
    { cmd: "roblox test", desc: "Send a test update notification" }
  ],
  "Role Management": [
    { cmd: "role add", desc: "Add a role to a member" },
    { cmd: "role all", desc: "Give a role to every member" },
    { cmd: "role remove", desc: "Remove a role from a member" }
  ],
  "Sticky Messages": [
    { cmd: "sticky message", desc: "Set a sticky message for the channel" },
    { cmd: "sticky remove", desc: "Remove the sticky message" }
  ],
  "Ticketing": [
    { cmd: "ticket close", desc: "Close the current ticket channel" },
    { cmd: "ticket setup", desc: "Create a ticket panel in a channel" }
  ],
  "Vouch System": [
    { cmd: "vouch", desc: "Create a new vouch for this server" },
    { cmd: "vouch_setup", desc: "Set the channel where vouches post" }
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
    { cmd: "riddle", desc: "Get a riddle to solve" }
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
    { cmd: "avatar", desc: "Display a user's avatar" }
  ],
};

export default function CommandAccessPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [commands, setCommands] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Bulk configure state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCmds, setSelectedCmds] = useState<Set<string>>(new Set());
  const [bulkRoles, setBulkRoles] = useState<string[]>([]);
  const bulkBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/commands`)
      .then((data) => setCommands(data?.commands || {}))
      .catch(() => toast("Failed to load commands config", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistCommands = useCallback(async (nextCommands: Record<string, string[]>) => {
    const cleanedCommands: Record<string, string[]> = {};
    for (const [cmd, roles] of Object.entries(nextCommands)) {
      if (roles && roles.length > 0) {
        cleanedCommands[cmd] = roles;
      }
    }

    await fetchApi(`/guilds/${guildId}/commands`, undefined, {
      method: "PUT",
      body: JSON.stringify({ commands: cleanedCommands }),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: commands,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistCommands,
    onError: (err: any) => toast(err?.message || "Auto-save failed for command access", "error"),
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

  const handleRoleChange = (cmd: string, roleIds: string[]) => {
    setCommands((prev) => ({ ...prev, [cmd]: roleIds }));
  };

  // Bulk mode helpers
  const toggleBulkMode = () => {
    setBulkMode((v) => !v);
    setSelectedCmds(new Set());
    setBulkRoles([]);
    setExpandedCmd(null);
  };

  const toggleCmd = (cmd: string) => {
    setSelectedCmds((prev) => {
      const next = new Set(prev);
      if (next.has(cmd)) next.delete(cmd);
      else next.add(cmd);
      return next;
    });
  };

  const toggleCategory = (cmdList: { cmd: string }[]) => {
    const keys = cmdList.map((c) => c.cmd);
    const allSelected = keys.every((k) => selectedCmds.has(k));
    setSelectedCmds((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const applyBulkRoles = () => {
    if (selectedCmds.size === 0) {
      toast("Select at least one command first.", "error");
      return;
    }
    setCommands((prev) => {
      const next = { ...prev };
      selectedCmds.forEach((cmd) => {
        next[cmd] = [...bulkRoles];
      });
      return next;
    });
    toast(`Applied ${bulkRoles.length} role(s) to ${selectedCmds.size} command(s).`);
    setSelectedCmds(new Set());
    setBulkRoles([]);
  };

  const clearBulkRoles = () => {
    if (selectedCmds.size === 0) {
      toast("Select at least one command first.", "error");
      return;
    }
    setCommands((prev) => {
      const next = { ...prev };
      selectedCmds.forEach((cmd) => {
        next[cmd] = [];
      });
      return next;
    });
    toast(`Cleared roles from ${selectedCmds.size} command(s).`);
    setSelectedCmds(new Set());
    setBulkRoles([]);
  };

  const totalCommands = Object.values(COMMAND_GROUPS).reduce((sum, list) => sum + list.length, 0);
  const restrictedCommands = Object.values(commands).filter((roles) => (roles?.length || 0) > 0).length;
  const totalRolesLinked = Object.values(commands).reduce((sum, roles) => sum + (roles?.length || 0), 0);

  return (
    <div className="glass-card flex flex-col gap-8 rounded-3xl p-6 pb-96">
      <DashboardPageHero
        icon={ShieldCheckIcon}
        title="Command Access Control"
        subtitle="Restrict sensitive commands to trusted roles while keeping public utilities open for everyone."
        stats={[
          { label: "Command Groups", value: Object.keys(COMMAND_GROUPS).length },
          { label: "Total Commands", value: totalCommands },
          { label: "Restricted Commands", value: restrictedCommands },
          { label: "Role Links", value: totalRolesLinked },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {new Date().getTime() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button
              onClick={toggleBulkMode}
              className={`flex items-center gap-2 transition-all shadow-md ${
                bulkMode
                  ? "bg-[#FAA61A] hover:bg-[#e09515] text-black font-bold"
                  : "bg-[#2B2D31] hover:bg-[#36383D] text-white"
              }`}
            >
              <Layers2Icon className="w-4 h-4" />
              {bulkMode ? "Exit Bulk Mode" : "Bulk Configure"}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#5865F2] hover:bg-[#4752C4] shadow-md transition-all">
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </div>
        }
      />

      {/* Bulk mode hint */}
      {bulkMode && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FAA61A]/30 bg-[#FAA61A]/[0.06] px-4 py-3 text-sm text-[#FAA61A]">
          <Layers2Icon className="w-4 h-4 shrink-0" />
          <span>
            <strong>Bulk mode active.</strong> Click commands to select them, then use the action bar at the bottom to apply roles to all selected commands at once.
            {selectedCmds.size > 0 && (
              <span className="ml-2 font-bold text-white">{selectedCmds.size} selected</span>
            )}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-10">
        {Object.entries(COMMAND_GROUPS).map(([category, cmdList]) => {
          const allInCatSelected = bulkMode && cmdList.every((c) => selectedCmds.has(c.cmd));
          const someInCatSelected = bulkMode && cmdList.some((c) => selectedCmds.has(c.cmd));

          return (
            <div key={category} className="flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-[#2B2D31] pb-2">
                {bulkMode && (
                  <button
                    onClick={() => toggleCategory(cmdList)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#B5BAC1] hover:text-white transition-colors shrink-0"
                    title={allInCatSelected ? "Deselect all in category" : "Select all in category"}
                  >
                    {allInCatSelected ? (
                      <CheckSquareIcon className="w-4 h-4 text-[#5865F2]" />
                    ) : someInCatSelected ? (
                      <CheckSquareIcon className="w-4 h-4 text-[#5865F2]/50" />
                    ) : (
                      <SquareIcon className="w-4 h-4 text-[#4B4D55]" />
                    )}
                    All
                  </button>
                )}
                <h2 className="text-xl font-bold tracking-tight text-white">{category}</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {cmdList.map(({ cmd, desc }) => {
                  const isActive = commands[cmd] && commands[cmd].length > 0;
                  const isExpanded = !bulkMode && expandedCmd === cmd;
                  const isSelected = bulkMode && selectedCmds.has(cmd);

                  return (
                    <div
                      key={cmd}
                      className={`relative rounded-xl border transition-all duration-200 overflow-visible ${
                        bulkMode
                          ? isSelected
                            ? "border-[#FAA61A] bg-[#FAA61A]/[0.07] shadow-[0_0_10px_rgba(250,166,26,0.15)] cursor-pointer"
                            : "border-[#1E1F22] bg-[#1a1b1e] hover:border-[#FAA61A]/40 cursor-pointer"
                          : isExpanded
                          ? "border-[#5865F2] bg-[#1a1b1e] shadow-[0_0_12px_rgba(88,101,242,0.15)] ring-1 ring-[#5865F2]/50 cursor-pointer"
                          : isActive
                          ? "border-[#5865F2]/40 bg-[#5865F2]/[0.03] hover:border-[#5865F2]/60 cursor-pointer"
                          : "border-[#1E1F22] bg-[#1a1b1e] hover:border-[#5865F2]/30 hover:bg-[#1f2125] cursor-pointer"
                      }`}
                      onClick={() => {
                        if (bulkMode) toggleCmd(cmd);
                        else setExpandedCmd(isExpanded ? null : cmd);
                      }}
                    >
                      <div className="flex items-start justify-between p-4">
                        <div className="flex items-start gap-2 min-w-0">
                          {bulkMode && (
                            <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isSelected ? "bg-[#FAA61A] border-[#FAA61A]" : "border-[#4B4D55] bg-transparent"
                            }`}>
                              {isSelected && (
                                <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 10">
                                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className={`text-[14px] font-semibold transition-colors leading-none ${isActive || isExpanded || isSelected ? "text-white" : "text-[#B5BAC1]"}`}>
                              <span className={isActive || isExpanded || isSelected ? "text-[#5865F2]" : "text-[#5865F2]/70"}>/</span>{cmd}
                            </h3>
                            {desc && (
                              <p className={`text-[11px] mt-2 line-clamp-2 leading-tight ${isActive || isExpanded || isSelected ? "text-[#a0a4ab]" : "text-[#7a7e86]"}`}>
                                {desc}
                              </p>
                            )}
                          </div>
                        </div>
                        {isActive && (
                          <span className="text-[10px] shrink-0 ml-2 bg-[#5865F2] text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                            {commands[cmd].length} Roles
                          </span>
                        )}
                      </div>

                      {isExpanded && (
                        <div
                          className="px-4 pb-4 pt-1 border-t border-[#2B2D31] bg-[#141518] rounded-b-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mt-3">
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
                              Allowed Roles
                            </label>
                            <RoleMultiSelect
                              guildId={guildId}
                              value={(commands[cmd] || []).map(String)}
                              onChange={(ids) => handleRoleChange(cmd, ids)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky bulk action bar */}
      {bulkMode && (
        <div
          ref={bulkBarRef}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-[#FAA61A]/40 bg-[#1a1b1e]/95 backdrop-blur-md shadow-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#FAA61A]">
                {selectedCmds.size > 0
                  ? `${selectedCmds.size} command${selectedCmds.size !== 1 ? "s" : ""} selected`
                  : "No commands selected"}
              </span>
              <button
                onClick={toggleBulkMode}
                className="text-[#B5BAC1] hover:text-white transition-colors"
                title="Exit bulk mode"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
                Roles to Apply
              </label>
              <RoleMultiSelect
                guildId={guildId}
                value={bulkRoles}
                onChange={setBulkRoles}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={applyBulkRoles}
                disabled={selectedCmds.size === 0}
                className="flex-1 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-sm"
              >
                Apply to {selectedCmds.size > 0 ? selectedCmds.size : ""} Selected
              </Button>
              <Button
                onClick={clearBulkRoles}
                disabled={selectedCmds.size === 0}
                className="bg-[#ED4245]/20 hover:bg-[#ED4245]/30 border border-[#ED4245]/40 text-[#ED4245] disabled:opacity-40 text-sm px-4"
                title="Clear roles from selected commands"
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

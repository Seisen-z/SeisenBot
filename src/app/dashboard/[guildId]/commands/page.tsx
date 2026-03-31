"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleMultiSelect } from "@/components/ui/discord-selects";
import { RoleSelect } from "@/components/ui/discord-selects";

const COMMAND_GROUPS: Record<string, { cmd: string; desc: string }[]> = {
  "Administration & Moderation": [
    { cmd: "ban", desc: "Ban a member from the server" },
    { cmd: "baninfo", desc: "View the profile of a banned user" },
    { cmd: "banlist", desc: "List all banned users in the server" },
    { cmd: "clear", desc: "Clear a specific number of messages" },
    { cmd: "kick", desc: "Kick a member from the server" },
    { cmd: "purge", desc: "Purge messages in the channel" },
    { cmd: "unban", desc: "Unban a user from the server by their ID" }
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
  "Music Player": [
    { cmd: "music leave", desc: "Leave the voice channel and clear queue" },
    { cmd: "music loop", desc: "Set loop mode" },
    { cmd: "music now", desc: "Show the currently playing track" },
    { cmd: "music pause", desc: "Pause the current track" },
    { cmd: "music play", desc: "Play music and join your channel" },
    { cmd: "music queue", desc: "Show the current music queue" },
    { cmd: "music resume", desc: "Resume paused playback" },
    { cmd: "music shuffle", desc: "Shuffle the queued tracks" },
    { cmd: "music skip", desc: "Skip the current track" },
    { cmd: "music stop", desc: "Stop playback and clear the queue" }
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
  "General / Miscellaneous": [
    { cmd: "avatar", desc: "Show a user's avatar" },
    { cmd: "hello", desc: "Get a greeting from the bot" },
    { cmd: "help", desc: "Show all available commands" },
    { cmd: "invite", desc: "Get a permanent invite link" },
    { cmd: "invitelist", desc: "List all active invites" },
    { cmd: "ping", desc: "Check bot latency" },
    { cmd: "poll create", desc: "Create a new poll" },
    { cmd: "roll", desc: "Roll a dice" },
    { cmd: "say", desc: "Make the bot say something" },
    { cmd: "serverinfo", desc: "Display info about the server" },
    { cmd: "userinfo", desc: "Display info about a user" }
  ],
};

export default function CommandAccessPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [commands, setCommands] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/commands`)
      .then((data) => setCommands(data?.commands || {}))
      .catch(() => toast("Failed to load commands config", "error"));
  }, [guildId, toast]);

  const handleSave = async () => {
    setSaving(true);
    
    const cleanedCommands: Record<string, string[]> = {};
    for (const [cmd, roles] of Object.entries(commands)) {
      if (roles && roles.length > 0) {
        cleanedCommands[cmd] = roles;
      }
    }

    try {
      await fetchApi(`/guilds/${guildId}/commands`, undefined, {
        method: "PUT",
        body: JSON.stringify({ commands: cleanedCommands }),
      });
      toast("Command Config Saved!");
    } catch (e) {
      toast("Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = (cmd: string, roleIds: string[]) => {
    setCommands((prev) => ({
      ...prev,
      [cmd]: roleIds,
    }));
  };

  return (
    <div className="flex flex-col gap-8 pb-96">
      <div className="flex items-center justify-between sticky top-0 bg-[#313338]/95 backdrop-blur-md z-20 py-5 border-b border-[#1E1F22] -mx-6 px-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Command Access Control</h1>
          <p className="text-sm text-[#B5BAC1] mt-1">
            Restrict specific bot commands to certain roles. Leave blank to allow everyone.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#5865F2] hover:bg-[#4752C4] shadow-md transition-all">
          {saving ? "Saving..." : "Save Config"}
        </Button>
      </div>

      <div className="flex flex-col gap-10">
        {Object.entries(COMMAND_GROUPS).map(([category, cmdList]) => (
          <div key={category} className="flex flex-col gap-4">
            <h2 className="text-xl font-bold tracking-tight text-white border-b border-[#2B2D31] pb-2">
              {category}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {cmdList.map(({ cmd, desc }) => {
                const isActive = commands[cmd] && commands[cmd].length > 0;
                const isExpanded = expandedCmd === cmd;
                
                return (
                  <div 
                    key={cmd} 
                    className={`relative rounded-xl border transition-all duration-200 cursor-pointer overflow-visible ${
                      isExpanded 
                        ? "border-[#5865F2] bg-[#1a1b1e] shadow-[0_0_12px_rgba(88,101,242,0.15)] ring-1 ring-[#5865F2]/50" 
                        : isActive 
                        ? "border-[#5865F2]/40 bg-[#5865F2]/[0.03] hover:border-[#5865F2]/60" 
                        : "border-[#1E1F22] bg-[#1a1b1e] hover:border-[#5865F2]/30 hover:bg-[#1f2125]"
                    }`}
                    onClick={() => setExpandedCmd(isExpanded ? null : cmd)}
                  >
                    {/* Compact Card Header */}
                    <div className="flex items-start justify-between p-4">
                      <div>
                        <h3 className={`text-[14px] font-semibold transition-colors leading-none ${isActive || isExpanded ? "text-white" : "text-[#B5BAC1]"}`}>
                          <span className={isActive || isExpanded ? "text-[#5865F2]" : "text-[#5865F2]/70"}>/</span>{cmd}
                        </h3>
                        {desc && (
                          <p className={`text-[11px] mt-2 line-clamp-2 leading-tight ${isActive || isExpanded ? "text-[#a0a4ab]" : "text-[#7a7e86]"}`}>
                            {desc}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <span className="text-[10px] shrink-0 ml-2 bg-[#5865F2] text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                          {commands[cmd].length} Roles
                        </span>
                      )}
                    </div>

                    {/* Expandable Role Configuration Area */}
                    {isExpanded && (
                      <div 
                        className="px-4 pb-4 pt-1 border-t border-[#2B2D31] bg-[#141518] rounded-b-xl"
                        onClick={(e) => e.stopPropagation()} // Prevent clicking the roles from toggling the accordion
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
        ))}
      </div>
    </div>
  );
}

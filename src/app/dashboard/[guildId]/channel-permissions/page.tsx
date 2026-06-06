"use client";

import { useCallback, useEffect, useState, use, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import {
  ShieldIcon,
  SearchIcon,
  HashIcon,
  Volume2Icon,
  XIcon,
  PlusIcon,
  CheckIcon,
  MinusIcon,
} from "lucide-react";

// ── Permission definitions ────────────────────────────────────────────────────

const PERMISSION_GROUPS = [
  {
    label: "General Channel Permissions",
    perms: [
      { key: "view_channel",      label: "View Channel",        desc: "Allows members to view this channel" },
      { key: "manage_channel",    label: "Manage Channel",      desc: "Change channel name, description, and settings" },
      { key: "manage_permissions",label: "Manage Permissions",  desc: "Change permission overrides for this channel" },
      { key: "manage_webhooks",   label: "Manage Webhooks",     desc: "Create, edit, and delete webhooks" },
    ],
  },
  {
    label: "Membership Permissions",
    perms: [
      { key: "create_invite", label: "Create Invite", desc: "Invite others via a channel invite link" },
    ],
  },
  {
    label: "Text Channel Permissions",
    perms: [
      { key: "send_messages",            label: "Send Messages",                    desc: "Send messages in text channels" },
      { key: "send_messages_in_threads", label: "Send Messages in Threads",         desc: "Send messages in threads" },
      { key: "create_public_threads",    label: "Create Public Threads",            desc: "Create public threads from messages" },
      { key: "create_private_threads",   label: "Create Private Threads",           desc: "Create invite-only threads" },
      { key: "embed_links",              label: "Embed Links",                      desc: "Show embedded content for posted links" },
      { key: "attach_files",             label: "Attach Files",                     desc: "Upload files and media" },
      { key: "add_reactions",            label: "Add Reactions",                    desc: "Add emoji reactions to messages" },
      { key: "use_external_emojis",      label: "Use External Emojis",              desc: "Use custom emojis from other servers" },
      { key: "use_external_stickers",    label: "Use External Stickers",            desc: "Use stickers from other servers" },
      { key: "mention_everyone",         label: "Mention @everyone, @here, Roles",  desc: "Use @everyone, @here, and @role pings" },
      { key: "manage_messages",          label: "Manage Messages",                  desc: "Delete and pin messages from others" },
      { key: "manage_threads",           label: "Manage Threads",                   desc: "Rename, delete, and archive threads" },
      { key: "read_message_history",     label: "Read Message History",             desc: "View messages sent before joining" },
      { key: "send_tts_messages",        label: "Send TTS Messages",                desc: "Send text-to-speech messages" },
      { key: "use_application_commands", label: "Use Application Commands",         desc: "Use slash commands and app commands" },
      { key: "send_voice_messages",      label: "Send Voice Messages",              desc: "Send voice messages" },
    ],
  },
];

type PermState = "allow" | "deny" | "neutral";

type RoleOverride = {
  role_id: string;
  allow: string[];
  deny: string[];
};

type ChannelConfig = Record<string, RoleOverride[]>;

type DiscordChannel = { id: string; name: string; type: number; parent_id?: string | null; position?: number };
type DiscordRole    = { id: string; name: string; color: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function permStateOf(override: RoleOverride, key: string): PermState {
  if (override.allow.includes(key)) return "allow";
  if (override.deny.includes(key))  return "deny";
  return "neutral";
}

function cycleState(cur: PermState): PermState {
  if (cur === "neutral") return "allow";
  if (cur === "allow")   return "deny";
  return "neutral";
}

function setPermState(override: RoleOverride, key: string, state: PermState): RoleOverride {
  const allow = override.allow.filter((p) => p !== key);
  const deny  = override.deny.filter((p)  => p !== key);
  if (state === "allow") allow.push(key);
  if (state === "deny")  deny.push(key);
  return { ...override, allow, deny };
}

function intToRgb(color: number) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8)  & 0xff;
  const b = color          & 0xff;
  return `rgb(${r},${g},${b})`;
}

// ── Permission toggle button ──────────────────────────────────────────────────

function PermToggle({ state, onClick }: { state: PermState; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 rounded flex items-center justify-center transition-colors border text-xs font-bold ${
        state === "allow"
          ? "bg-[#57F287]/20 border-[#57F287]/50 text-[#57F287]"
          : state === "deny"
          ? "bg-[#ED4245]/20 border-[#ED4245]/50 text-[#ED4245]"
          : "bg-white/5 border-white/10 text-[#6b7280]"
      }`}
      title={state === "allow" ? "Allow — click to deny" : state === "deny" ? "Deny — click to reset" : "Neutral — click to allow"}
    >
      {state === "allow" ? <CheckIcon className="w-3.5 h-3.5" /> : state === "deny" ? <XIcon className="w-3.5 h-3.5" /> : <MinusIcon className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChannelPermissionsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles]       = useState<DiscordRole[]>([]);
  const [config, setConfig]     = useState<ChannelConfig>({});
  const [saving, setSaving]     = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelSearch, setChannelSearch]     = useState("");
  const [addRoleSearch, setAddRoleSearch]     = useState("");
  const [showRolePicker, setShowRolePicker]   = useState(false);

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchApi(`/guilds/${guildId}/channels`),
      fetchApi(`/guilds/${guildId}/roles`),
      fetchApi(`/guilds/${guildId}/channel-permissions`),
    ])
      .then(([ch, ro, cfg]) => {
        setChannels((ch as DiscordChannel[]) || []);
        setRoles((ro as DiscordRole[]) || []);
        setConfig((cfg as any)?.channels || {});
      })
      .catch(() => toast("Failed to load channel permissions", "error"))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  // ── Auto-save ───────────────────────────────────────────────────────────────
  const persistConfig = useCallback(
    async (next: ChannelConfig) => {
      await fetchApi(`/guilds/${guildId}/channel-permissions`, undefined, {
        method: "PUT",
        body: JSON.stringify({ channels: next }),
      });
      setLastSaved(new Date());
    },
    [guildId]
  );

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: (err: any) => toast(err?.message || "Auto-save failed", "error"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast("Channel permissions saved and applied!");
    } catch (e: any) {
      toast(e?.message || "Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Channel tree ────────────────────────────────────────────────────────────
  // type 0 = text, type 2 = voice, type 4 = category, type 5 = announcement, type 15 = forum
  const textChannels = useMemo(
    () => channels.filter((c) => [0, 2, 5, 15].includes(c.type)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [channels]
  );

  const categories = useMemo(() => {
    const cats = channels.filter((c) => c.type === 4).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return cats;
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return textChannels;
    return textChannels.filter((c) => c.name.toLowerCase().includes(q));
  }, [textChannels, channelSearch]);

  // Group channels under their category
  const grouped = useMemo(() => {
    const map = new Map<string | null, DiscordChannel[]>();
    map.set(null, []);
    for (const cat of categories) map.set(cat.id, []);
    for (const ch of filteredChannels) {
      const key = ch.parent_id ?? null;
      if (!map.has(key)) map.set(null, [...(map.get(null) ?? [])]);
      map.set(key, [...(map.get(key) ?? []), ch]);
    }
    return map;
  }, [filteredChannels, categories]);

  // ── Role overrides for selected channel ─────────────────────────────────────
  const overrides = selectedChannel ? (config[selectedChannel] ?? []) : [];

  const updateOverride = (roleId: string, key: string, state: PermState) => {
    if (!selectedChannel) return;
    setConfig((prev) => {
      const list = prev[selectedChannel] ?? [];
      const idx  = list.findIndex((o) => o.role_id === roleId);
      if (idx === -1) return prev;
      const updated = [...list];
      updated[idx]  = setPermState(updated[idx], key, state);
      return { ...prev, [selectedChannel]: updated };
    });
  };

  const addRole = (roleId: string) => {
    if (!selectedChannel) return;
    setConfig((prev) => {
      const list = prev[selectedChannel] ?? [];
      if (list.some((o) => o.role_id === roleId)) return prev;
      return { ...prev, [selectedChannel]: [...list, { role_id: roleId, allow: [], deny: [] }] };
    });
    setShowRolePicker(false);
    setAddRoleSearch("");
  };

  const removeRole = (roleId: string) => {
    if (!selectedChannel) return;
    setConfig((prev) => ({
      ...prev,
      [selectedChannel]: (prev[selectedChannel] ?? []).filter((o) => o.role_id !== roleId),
    }));
  };

  const roleMap = useMemo(() => {
    const m: Record<string, DiscordRole> = {};
    for (const r of roles) m[r.id] = r;
    return m;
  }, [roles]);

  const availableRoles = useMemo(() => {
    const q   = addRoleSearch.trim().toLowerCase();
    const used = new Set(overrides.map((o) => o.role_id));
    return roles
      .filter((r) => r.id !== guildId) // exclude @everyone
      .filter((r) => !used.has(r.id))
      .filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [roles, overrides, addRoleSearch, guildId]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const configuredChannels = Object.values(config).filter((v) => v.length > 0).length;
  const totalOverrides      = Object.values(config).reduce((s, v) => s + v.length, 0);

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-6 min-h-screen">
      <DashboardPageHero
        icon={ShieldIcon}
        title="Channel Permissions"
        subtitle="Configure role permissions for each channel directly from the dashboard."
        stats={[
          { label: "Total Channels",      value: textChannels.length },
          { label: "Configured Channels", value: configuredChannels },
          { label: "Role Overrides",      value: totalOverrides },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && !saving && (
              <span className="text-xs text-green-400">
                Saved {Date.now() - lastSaved.getTime() < 10000 ? "just now" : "recently"}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving} className="bg-[#5865F2] hover:bg-[#4752C4] shadow-md">
              {saving ? "Saving..." : "Save & Apply"}
            </Button>
          </div>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0" style={{ height: "calc(100vh - 280px)" }}>
        {/* ── Left: Channel list ── */}
        <div className="w-56 shrink-0 flex flex-col rounded-xl border border-[#1E1F22] bg-[#141518] overflow-hidden">
          <div className="p-2 border-b border-[#1E1F22]">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b7280] pointer-events-none" />
              <input
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder="Search channels…"
                className="w-full rounded-lg border border-[#2B2D31] bg-[#1a1b1e] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#6b7280] outline-none focus:border-[#5865F2]/60"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {[...grouped.entries()].map(([catId, chList]) => {
              if (chList.length === 0) return null;
              const catName = catId ? categories.find((c) => c.id === catId)?.name : null;
              return (
                <div key={catId ?? "uncategorized"}>
                  {catName && (
                    <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">
                      {catName}
                    </p>
                  )}
                  {chList.map((ch) => {
                    const isText  = [0, 5].includes(ch.type);
                    const hasConf = (config[ch.id]?.length ?? 0) > 0;
                    const isSel   = selectedChannel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChannel(ch.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                          isSel
                            ? "bg-[#5865F2]/20 text-white"
                            : "text-[#8d9199] hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {isText ? (
                          <HashIcon className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Volume2Icon className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="text-xs truncate flex-1">{ch.name}</span>
                        {hasConf && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#5865F2]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {filteredChannels.length === 0 && (
              <p className="px-3 py-4 text-xs text-[#6b7280]">No channels found.</p>
            )}
          </div>
        </div>

        {/* ── Right: Permission editor ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selectedChannel ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-[#1E1F22] bg-[#141518]">
              <div className="text-center">
                <HashIcon className="w-10 h-10 text-[#3C3F45] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#B5BAC1]">Select a channel</p>
                <p className="text-xs text-[#6b7280] mt-1">Choose a channel from the left to configure role permissions</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Channel header */}
              <div className="flex items-center justify-between rounded-xl border border-[#1E1F22] bg-[#141518] px-4 py-3">
                <div className="flex items-center gap-2">
                  <HashIcon className="w-4 h-4 text-[#6b7280]" />
                  <span className="font-semibold text-white text-sm">
                    {channels.find((c) => c.id === selectedChannel)?.name ?? selectedChannel}
                  </span>
                  {overrides.length > 0 && (
                    <span className="text-[10px] bg-[#5865F2] text-white px-2 py-0.5 rounded-full font-bold">
                      {overrides.length} override{overrides.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Add role button */}
                <div className="relative">
                  <Button
                    onClick={() => { setShowRolePicker((v) => !v); setAddRoleSearch(""); }}
                    className="bg-[#2B2D31] hover:bg-[#36383D] text-white text-xs flex items-center gap-1.5 px-3 py-1.5 h-auto"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add Role
                  </Button>
                  {showRolePicker && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-[#2B2D31] bg-[#1a1b1e] shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-[#2B2D31]">
                        <input
                          autoFocus
                          value={addRoleSearch}
                          onChange={(e) => setAddRoleSearch(e.target.value)}
                          placeholder="Search roles…"
                          className="w-full rounded-lg bg-[#141518] border border-[#2B2D31] px-3 py-1.5 text-xs text-white placeholder-[#6b7280] outline-none focus:border-[#5865F2]/60"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {availableRoles.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-[#6b7280]">No roles available</p>
                        ) : (
                          availableRoles.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => addRole(r.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: r.color ? intToRgb(r.color) : "#99aab5" }}
                              />
                              <span className="text-xs text-white truncate">{r.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Role override cards */}
              {overrides.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#2B2D31] bg-[#141518] py-10 text-center">
                  <p className="text-sm text-[#6b7280]">No role overrides configured for this channel.</p>
                  <p className="text-xs text-[#4B4D55] mt-1">Click "Add Role" to configure permissions for a specific role.</p>
                </div>
              ) : (
                overrides.map((ow) => {
                  const role = roleMap[ow.role_id];
                  return (
                    <div key={ow.role_id} className="rounded-xl border border-[#1E1F22] bg-[#141518] overflow-hidden">
                      {/* Role header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1F22] bg-[#111315]">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ background: role?.color ? intToRgb(role.color) : "#99aab5" }}
                          />
                          <span className="text-sm font-semibold text-white">{role?.name ?? ow.role_id}</span>
                          {ow.allow.length > 0 && (
                            <span className="text-[10px] bg-[#57F287]/20 text-[#57F287] border border-[#57F287]/30 px-1.5 py-0.5 rounded-full">
                              {ow.allow.length} allowed
                            </span>
                          )}
                          {ow.deny.length > 0 && (
                            <span className="text-[10px] bg-[#ED4245]/20 text-[#ED4245] border border-[#ED4245]/30 px-1.5 py-0.5 rounded-full">
                              {ow.deny.length} denied
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeRole(ow.role_id)}
                          className="text-[#6b7280] hover:text-[#ED4245] transition-colors"
                          title="Remove this role override"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Permission groups */}
                      <div className="divide-y divide-[#1E1F22]">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.label} className="px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">
                              {group.label}
                            </p>
                            <div className="flex flex-col gap-1">
                              {group.perms.map((perm) => {
                                const state = permStateOf(ow, perm.key);
                                return (
                                  <div
                                    key={perm.key}
                                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.02] transition-colors"
                                  >
                                    <div className="min-w-0 mr-4">
                                      <p className={`text-sm font-medium leading-none ${state !== "neutral" ? "text-white" : "text-[#B5BAC1]"}`}>
                                        {perm.label}
                                      </p>
                                      <p className="text-[11px] text-[#6b7280] mt-0.5 leading-tight">{perm.desc}</p>
                                    </div>
                                    <PermToggle
                                      state={state}
                                      onClick={() => updateOverride(ow.role_id, perm.key, cycleState(state))}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Click-outside to close role picker */}
      {showRolePicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowRolePicker(false)} />
      )}
    </div>
  );
}

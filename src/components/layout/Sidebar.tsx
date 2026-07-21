"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRightIcon,
  SearchIcon,
  MessageSquareReply,
  Bot,
  Megaphone,
  Ticket,
  BarChart3,
  Gamepad2,
  Pin,
  Rocket,
  ShieldCheck,
  Settings2,
  UserPlus,
  SparklesIcon,
  BellRing,
  UserCheck,
  GiftIcon,
  UsersIcon,
  ShieldAlert,
  Key,
  ClipboardListIcon,
  AtSign,
  TrendingUpIcon,
  KeyRoundIcon,
  ShieldBanIcon,
} from "lucide-react";

export default function Sidebar({
  guildId,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  userDisplayName = "Guest",
  userSubtext = "N/A",
  userAvatarUrl = null,
}: {
  guildId: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  userDisplayName?: string;
  userSubtext?: string;
  userAvatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  type NavItem = {
    name: string;
    href: string;
    icon: ComponentType<any>;
    exact?: boolean;
  };
  type NavSection = { label: string; items: NavItem[] };

  const navSections: NavSection[] = [
    {
      label: "Core",
      items: [
        { name: "Home", href: `/dashboard/${guildId}`, icon: SparklesIcon, exact: true },
      ],
    },
    {
      label: "Automation",
      items: [
        { name: "Auto Moderation", href: `/dashboard/${guildId}/automod`, icon: ShieldAlert },
        { name: "Trap Channels", href: `/dashboard/${guildId}/trap-channels`, icon: ShieldBanIcon },
        { name: "Anti-Spam", href: `/dashboard/${guildId}/anti-spam`, icon: ShieldAlert },
        { name: "Ping Protection", href: `/dashboard/${guildId}/ping-protection`, icon: AtSign },
        { name: "Auto Reply", href: `/dashboard/${guildId}/autoreply`, icon: MessageSquareReply },
        { name: "AI Help", href: `/dashboard/${guildId}/ai-help`, icon: Bot },
        { name: "Announcements", href: `/dashboard/${guildId}/announcements`, icon: Megaphone },
        { name: "Select Menu Roles", href: `/dashboard/${guildId}/reaction-roles`, icon: UserPlus },
        { name: "Channel Access", href: `/dashboard/${guildId}/channel-access`, icon: KeyRoundIcon },
      ],
    },
    {
      label: "Operations",
      items: [
        { name: "Onboarding", href: `/dashboard/${guildId}/onboarding`, icon: UserCheck },
        { name: "Giveaways", href: `/dashboard/${guildId}/giveaways`, icon: GiftIcon },
        { name: "Activity Rewards", href: `/dashboard/${guildId}/activity-rewards`, icon: GiftIcon },
        { name: "Leveling", href: `/dashboard/${guildId}/leveling`, icon: TrendingUpIcon },
        { name: "Fun Commands", href: `/dashboard/${guildId}/fun-commands`, icon: SparklesIcon },
        { name: "Member Counter", href: `/dashboard/${guildId}/member-counter`, icon: UsersIcon },
        { name: "Role Counters", href: `/dashboard/${guildId}/role-counters`, icon: UsersIcon },
        { name: "Social Notifications", href: `/dashboard/${guildId}/social`, icon: BellRing },
        { name: "Roblox Monitor", href: `/dashboard/${guildId}/roblox`, icon: Gamepad2 },
        { name: "Sticky Messages", href: `/dashboard/${guildId}/sticky`, icon: Pin },
        { name: "Boost Rewards", href: `/dashboard/${guildId}/boost`, icon: Rocket },
        { name: "Vouch System", href: `/dashboard/${guildId}/vouch`, icon: ShieldCheck },
      ],
    },
    {
      label: "Misc",
      items: [
        { name: "Command Access", href: `/dashboard/${guildId}/commands`, icon: Settings2 },
        { name: "Reaction Roles", href: `/dashboard/${guildId}/reaction-roles`, icon: UserPlus },
        { name: "Polls", href: `/dashboard/${guildId}/polls`, icon: BarChart3 },
        { name: "Tickets Panel", href: `/dashboard/${guildId}/tickets`, icon: Ticket },
        { name: "Key Panels", href: `/dashboard/${guildId}/key-panels`, icon: Key },
        { name: "Applications", href: `/dashboard/${guildId}/applications`, icon: ClipboardListIcon },
      ],
    },
  ];
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return navSections;
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.name.toLowerCase().includes(normalizedSearch)),
      }))
      .filter((section) => section.items.length > 0);
  }, [navSections, normalizedSearch]);

  return (
    <div className="flex h-full w-full max-h-screen flex-col border-r border-white/10 bg-[linear-gradient(180deg,#0b0c10_0%,#111218_100%)]">
      <div className={cn("shrink-0 border-b border-white/10", collapsed ? "px-2 pb-3 pt-4" : "px-4 pb-4 pt-5")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between gap-2")}>
          <Link href={`/dashboard/${guildId}`} onClick={onNavigate} className={cn("rounded-xl transition hover:bg-white/5", collapsed ? "p-1.5" : "flex items-center gap-3 px-2 py-1.5")}>
            <div className={cn("flex items-center justify-center overflow-hidden ring-1 ring-white/15", collapsed ? "h-10 w-10 rounded-lg" : "h-10 w-10 rounded-xl")}>
              <svg viewBox="0 0 64 64" className="h-full w-full">
                <defs>
                  <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#232326" />
                    <stop offset="100%" stopColor="#111113" />
                  </linearGradient>
                  <linearGradient id="logoStroke" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f4f6fb" />
                    <stop offset="100%" stopColor="#9da3b3" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="64" height="64" rx="13" fill="url(#logoBg)" />
                <path d="M14 19h36l-8 8H22l-8 8h20l8 8H14l8-8h20l8-8H30z" fill="url(#logoStroke)" />
                <circle cx="50" cy="14" r="3" fill="#ffffff" opacity="0.8" />
              </svg>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-wide text-white">Seisen Hub</p>
                <p className="truncate text-[11px] text-discord-text-muted">Dashboard</p>
              </div>
            )}
          </Link>
        </div>

        <div className={cn("mt-4", collapsed ? "px-0" : "px-0")}>
          <div
            className={cn(
              "rounded-xl border border-white/10 bg-[rgba(255,255,255,0.02)]",
              collapsed ? "mx-auto flex h-10 w-10 items-center justify-center" : "flex items-center gap-2 px-3 py-2.5"
            )}
          >
            <SearchIcon className="h-4 w-4 text-discord-text-muted" />
            {!collapsed && (
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search features..."
                className="w-full bg-transparent text-xs text-discord-text placeholder:text-discord-text-muted focus:outline-none"
                aria-label="Search sidebar features"
              />
            )}
          </div>
        </div>
      </div>

      <nav className={cn("min-h-0 flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-discord-text-muted/70">
                  {section.label}
                </p>
              )}
              <div className={cn("space-y-1", collapsed && "flex flex-col items-center gap-1.5 space-y-0")}>
                {section.items.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={`${section.label}-${item.href}`}
                      href={item.href}
                      title={collapsed ? item.name : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "group relative overflow-hidden border border-transparent transition-all",
                        collapsed
                          ? "flex h-10 w-10 items-center justify-center rounded-lg"
                          : "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium",
                        isActive
                          ? "border-white/20 bg-[rgba(255,255,255,0.11)] text-white"
                          : "text-discord-text-muted hover:border-white/12 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {!collapsed && isActive && <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-white/75" />}
                      <Icon className={cn("shrink-0", collapsed ? "h-4.5 w-4.5" : "h-4 w-4", isActive ? "text-white" : "text-discord-text-muted group-hover:text-white")} />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {!collapsed && filteredSections.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-discord-text-muted">
              No matching features.
            </div>
          )}
        </div>
      </nav>

      <div className={cn("shrink-0 border-t border-white/10", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-[rgba(255,255,255,0.02)] text-discord-text-muted transition hover:text-white"
            aria-label="Expand sidebar"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[rgba(255,255,255,0.03)] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={userDisplayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#1a1b21] text-xs font-bold text-white">
                    {(userDisplayName || "G").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
              <p className="max-w-[11rem] truncate text-xs text-white">{userDisplayName}</p>
              <p className="max-w-[11rem] truncate text-[11px] text-discord-text-muted">{userSubtext}</p>
              </div>
            </div>
            <SparklesIcon className="h-4 w-4 text-discord-text-muted" />
          </div>
        )}
      </div>
    </div>
  );
}

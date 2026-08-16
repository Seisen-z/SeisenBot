"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeftIcon,
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
  Bell,
  UserCheck,
  Gift,
  Users,
  ShieldAlert,
  Key,
  ClipboardListIcon,
  AtSign,
  TrendingUp,
  KeyRoundIcon,
  ShieldBanIcon,
  FileJson2Icon,
  RotateCw,
  History,
  PenLine,
  Zap,
  Smile,
  Tags,
  Lock,
} from "lucide-react";

interface SidebarProps {
  guildId: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  userDisplayName?: string;
  userSubtext?: string;
  userAvatarUrl?: string | null;
}

export default function Sidebar({
  guildId,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  userDisplayName = "Guest",
  userSubtext = "N/A",
  userAvatarUrl = null,
}: SidebarProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  type NavItem = {
    name: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    exact?: boolean;
  };
  type NavSection = { label: string; items: NavItem[] };

  const navSections: NavSection[] = [
    {
      label: "Core",
      items: [
        { name: "Home", href: `/dashboard/${guildId}`, icon: SparklesIcon, exact: true },
        { name: "Audit Logs", href: `/dashboard/${guildId}/audit-logs`, icon: History },
      ],
    },
    {
      label: "Security",
      items: [
        { name: "Auto Moderation", href: `/dashboard/${guildId}/automod`, icon: ShieldAlert },
        { name: "Anti-Spam", href: `/dashboard/${guildId}/anti-spam`, icon: ShieldBanIcon },
        { name: "Ping Protection", href: `/dashboard/${guildId}/ping-protection`, icon: AtSign },
        { name: "Trap Channels", href: `/dashboard/${guildId}/trap-channels`, icon: Lock },
        { name: "Channel Access", href: `/dashboard/${guildId}/channel-access`, icon: KeyRoundIcon },
      ],
    },
    {
      label: "Automation",
      items: [
        { name: "Auto Reply", href: `/dashboard/${guildId}/autoreply`, icon: MessageSquareReply },
        { name: "AI Help", href: `/dashboard/${guildId}/ai-help`, icon: Bot },
        { name: "Announcements", href: `/dashboard/${guildId}/announcements`, icon: Megaphone },
        { name: "Auto-Post", href: `/dashboard/${guildId}/auto-post`, icon: RotateCw },
        { name: "Sticky Messages", href: `/dashboard/${guildId}/sticky`, icon: Pin },
        { name: "Channel Renamer", href: `/dashboard/${guildId}/rename-channels`, icon: PenLine },
        { name: "Macro Import", href: `/dashboard/${guildId}/macro-import`, icon: FileJson2Icon },
      ],
    },
    {
      label: "Community",
      items: [
        { name: "Leveling", href: `/dashboard/${guildId}/leveling`, icon: TrendingUp },
        { name: "Activity Rewards", href: `/dashboard/${guildId}/activity-rewards`, icon: Zap },
        { name: "Giveaways", href: `/dashboard/${guildId}/giveaways`, icon: Gift },
        { name: "Boost Rewards", href: `/dashboard/${guildId}/boost`, icon: Rocket },
        { name: "Vouch System", href: `/dashboard/${guildId}/vouch`, icon: ShieldCheck },
        { name: "Fun Commands", href: `/dashboard/${guildId}/fun-commands`, icon: Smile },
        { name: "Social Notifications", href: `/dashboard/${guildId}/social`, icon: Bell },
        { name: "Roblox Monitor", href: `/dashboard/${guildId}/roblox`, icon: Gamepad2 },
      ],
    },
    {
      label: "Members",
      items: [
        { name: "Onboarding", href: `/dashboard/${guildId}/onboarding`, icon: UserCheck },
        { name: "Reaction Roles", href: `/dashboard/${guildId}/reaction-roles`, icon: UserPlus },
        { name: "Member Counter", href: `/dashboard/${guildId}/member-counter`, icon: Users },
        { name: "Role Counters", href: `/dashboard/${guildId}/role-counters`, icon: Tags },
      ],
    },
    {
      label: "Tools",
      items: [
        { name: "Tickets", href: `/dashboard/${guildId}/tickets`, icon: Ticket },
        { name: "Key Panels", href: `/dashboard/${guildId}/key-panels`, icon: Key },
        { name: "Applications", href: `/dashboard/${guildId}/applications`, icon: ClipboardListIcon },
        { name: "Polls", href: `/dashboard/${guildId}/polls`, icon: BarChart3 },
        { name: "Command Access", href: `/dashboard/${guildId}/commands`, icon: Settings2 },
      ],
    },
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return navSections;
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.name.toLowerCase().includes(normalizedSearch)
        ),
      }))
      .filter((section) => section.items.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSearch, guildId]);

  const avatarInitial = (userDisplayName || "G").charAt(0).toUpperCase();

  return (
    <div
      className="flex h-full w-full max-h-screen flex-col"
      style={{
        background: "linear-gradient(180deg, #08090d 0%, #0a0b0f 100%)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* ── Header: logo + collapse toggle ─────────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 flex items-center gap-2",
          collapsed ? "px-2 py-3" : "px-3 py-3"
        )}
      >
        <Link
          href={`/dashboard/${guildId}`}
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 flex-1 items-center rounded-lg transition-colors duration-150 hover:bg-white/[0.05]",
            collapsed ? "justify-center p-2" : "gap-3 px-2 py-2"
          )}
        >
          <div
            className="shrink-0 flex h-7 w-7 items-center justify-center overflow-hidden rounded-md"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}
          >
            <svg viewBox="0 0 64 64" className="h-full w-full">
              <defs>
                <linearGradient id="sbLogoBg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1e1f24" />
                  <stop offset="100%" stopColor="#111113" />
                </linearGradient>
                <linearGradient id="sbLogoMark" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f4f6fb" />
                  <stop offset="100%" stopColor="#9da3b3" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="64" height="64" rx="13" fill="url(#sbLogoBg)" />
              <path
                d="M14 19h36l-8 8H22l-8 8h20l8 8H14l8-8h20l8-8H30z"
                fill="url(#sbLogoMark)"
              />
              <circle cx="50" cy="14" r="3" fill="#ffffff" opacity="0.75" />
            </svg>
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight text-white">
                Seisen Hub
              </p>
              <p className="truncate text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                Dashboard
              </p>
            </div>
          )}
        </Link>

        {/* Collapse toggle always in header */}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 hover:bg-white/[0.07]"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            {collapsed ? (
              <ChevronRightIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="shrink-0 px-3 pb-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-[7px] transition-colors duration-150 focus-within:bg-white/[0.06]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <SearchIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features..."
              className="w-full bg-transparent text-[12px] focus:outline-none"
              style={{ color: "rgba(255,255,255,0.75)" }}
              aria-label="Search sidebar features"
            />
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="shrink-0 mx-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav
        className={cn(
          "min-h-0 flex-1 overflow-y-auto py-3",
          collapsed ? "px-2" : "px-2"
        )}
      >
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p
                  className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.13em]"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                >
                  {section.label}
                </p>
              )}

              <div
                className={cn(
                  "space-y-0.5",
                  collapsed && "flex flex-col items-center gap-1 space-y-0"
                )}
              >
                {section.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={`${section.label}-${item.href}`}
                      href={item.href}
                      title={collapsed ? item.name : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center rounded-lg transition-colors duration-150",
                        collapsed
                          ? "h-9 w-9 justify-center"
                          : "gap-2.5 px-3 py-[7px]"
                      )}
                      style={
                        isActive
                          ? { background: "rgba(255,255,255,0.09)", color: "#ffffff" }
                          : { color: "rgba(255,255,255,0.40)" }
                      }
                      onMouseEnter={
                        !isActive
                          ? (e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "rgba(255,255,255,0.05)";
                              (e.currentTarget as HTMLElement).style.color =
                                "rgba(255,255,255,0.78)";
                            }
                          : undefined
                      }
                      onMouseLeave={
                        !isActive
                          ? (e) => {
                              (e.currentTarget as HTMLElement).style.background = "";
                              (e.currentTarget as HTMLElement).style.color =
                                "rgba(255,255,255,0.40)";
                            }
                          : undefined
                      }
                    >
                      {/* Active left indicator */}
                      {isActive && !collapsed && (
                        <span
                          className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-full"
                          style={{ background: "rgba(255,255,255,0.65)" }}
                        />
                      )}

                      <span
                        className="shrink-0 transition-colors duration-150"
                        style={
                          isActive
                            ? { color: "#ffffff" }
                            : { color: "rgba(255,255,255,0.35)" }
                        }
                      >
                        <Icon className="h-[15px] w-[15px]" />
                      </span>

                      {!collapsed && (
                        <span className="truncate text-[13px] font-medium leading-none">
                          {item.name}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {!collapsed && filteredSections.length === 0 && (
            <p
              className="px-2 text-[12px]"
              style={{ color: "rgba(255,255,255,0.22)" }}
            >
              No matching features.
            </p>
          )}
        </div>
      </nav>

      {/* ── User footer ────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <div className="mx-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
        <div className={cn("p-3", collapsed && "flex justify-center")}>
          {collapsed ? (
            <div
              className="h-7 w-7 overflow-hidden rounded-full"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}
            >
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  {avatarInitial}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <div
                className="h-7 w-7 shrink-0 overflow-hidden rounded-full"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}
              >
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    {avatarInitial}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-white">
                  {userDisplayName}
                </p>
                <p
                  className="truncate text-[11px]"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  {userSubtext}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

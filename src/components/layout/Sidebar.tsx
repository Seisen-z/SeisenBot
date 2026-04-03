"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AudioLinesIcon,
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
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";

export default function Sidebar({ guildId, onNavigate }: { guildId: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  };

  const navGroups = [
    {
      label: "Automation",
      items: [
        { name: "Auto Reply", href: `/dashboard/${guildId}/autoreply`, icon: MessageSquareReply },
        { name: "AI Help", href: `/dashboard/${guildId}/ai-help`, icon: Bot },
        { name: "Announcements", href: `/dashboard/${guildId}/announcements`, icon: Megaphone },
        { name: "Select Menu Roles", href: `/dashboard/${guildId}/reaction-roles`, icon: UserPlus },
      ],
    },
    {
      label: "Operations",
      items: [
        { name: "Onboarding", href: `/dashboard/${guildId}/onboarding`, icon: UserCheck },
        { name: "Tickets", href: `/dashboard/${guildId}/tickets`, icon: Ticket },
        { name: "Polls", href: `/dashboard/${guildId}/polls`, icon: BarChart3 },
        { name: "Giveaways", href: `/dashboard/${guildId}/giveaways`, icon: GiftIcon },
        { name: "Member Counter", href: `/dashboard/${guildId}/member-counter`, icon: UsersIcon },
        { name: "Social Notifications", href: `/dashboard/${guildId}/social`, icon: BellRing },
        { name: "Roblox Monitor", href: `/dashboard/${guildId}/roblox`, icon: Gamepad2 },
        { name: "Sticky Messages", href: `/dashboard/${guildId}/sticky`, icon: Pin },
        { name: "Boost Rewards", href: `/dashboard/${guildId}/boost`, icon: Rocket },
        { name: "Vouch System", href: `/dashboard/${guildId}/vouch`, icon: ShieldCheck },
        { name: "Command Access", href: `/dashboard/${guildId}/commands`, icon: Settings2 },
      ],
    },
  ];

  return (
    <div className="glass-card flex h-full w-full flex-col rounded-none border-y-0 border-l-0 bg-[linear-gradient(180deg,_rgba(10,19,30,0.95)_0%,_rgba(9,16,25,0.95)_100%)] max-h-screen">
      <div className="border-b border-white/10 px-4 py-4 shrink-0">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-discord-blurple via-[#48b8d2] to-[#4f8ff7] text-sm font-black text-white shadow-[0_8px_22px_rgba(45,196,183,0.42)]">
            S
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-white">Seisen Hub</p>
            <p className="truncate text-[11px] uppercase tracking-[0.16em] text-discord-text-muted">Bot Command Center</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 min-h-0">
        {navGroups.map((group) => (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-discord-text-muted/85 hover:text-discord-text-muted transition-colors flex items-center gap-1.5 w-full text-left group"
            >
              {collapsedGroups[group.label] 
                ? <ChevronRightIcon className="h-3 w-3 text-discord-text-muted group-hover:text-white transition-colors" />
                : <ChevronDownIcon className="h-3 w-3 text-discord-text-muted group-hover:text-white transition-colors" />
              }
              {group.label}
            </button>

            {!collapsedGroups[group.label] && (
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-gradient-to-r from-discord-blurple/25 to-[#4f8ff7]/20 text-white shadow-[0_8px_20px_rgba(45,196,183,0.18)]"
                          : "text-discord-text-muted hover:bg-white/6 hover:text-white"
                      )}
                    >
                      {isActive && <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-discord-blurple" />}
                      <Icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-discord-blurple" : "text-discord-text-muted group-hover:text-discord-blurple")} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4 shrink-0">
        <div className="rounded-2xl border border-discord-blurple/30 bg-discord-blurple/10 p-3">
          <div className="mb-1 flex items-center gap-2 text-discord-blurple">
            <SparklesIcon className="h-4 w-4" />
            <p className="text-xs font-bold uppercase tracking-[0.15em]">Live Features</p>
          </div>
          <p className="text-xs leading-relaxed text-discord-text-muted">
            New templates, role workflows, and AI module upgrades are rolling out weekly.
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-discord-text-muted">
            <AudioLinesIcon className="h-3.5 w-3.5 text-discord-green" />
            Stable Runtime
          </div>
        </div>
      </div>
    </div>
  );
}

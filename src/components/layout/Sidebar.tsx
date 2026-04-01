"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageSquareReply,
  Bot,
  Megaphone,
  Ticket,
  Gamepad2,
  Pin,
  Rocket,
  ShieldCheck,
  Settings2,
  UserPlus
} from "lucide-react";

export default function Sidebar({ guildId }: { guildId: string }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Auto Reply", href: `/dashboard/${guildId}/autoreply`, icon: MessageSquareReply },
    { name: "AI Help", href: `/dashboard/${guildId}/ai-help`, icon: Bot },
    { name: "Announcements", href: `/dashboard/${guildId}/announcements`, icon: Megaphone },
    { name: "Select Menu Roles", href: `/dashboard/${guildId}/reaction-roles`, icon: UserPlus },
    { name: "Tickets", href: `/dashboard/${guildId}/tickets`, icon: Ticket },
    { name: "Roblox Monitor", href: `/dashboard/${guildId}/roblox`, icon: Gamepad2 },
    { name: "Sticky Messages", href: `/dashboard/${guildId}/sticky`, icon: Pin },
    { name: "Boost Rewards", href: `/dashboard/${guildId}/boost`, icon: Rocket },
    { name: "Vouch System", href: `/dashboard/${guildId}/vouch`, icon: ShieldCheck },
    { name: "Command Access", href: `/dashboard/${guildId}/commands`, icon: Settings2 },
  ];

  return (
    <div className="flex w-64 flex-col border-r border-[#1E1F22] bg-[#2B2D31]">
      <div className="flex h-14 items-center border-b border-[#1E1F22] px-4 font-bold tracking-wide text-white shadow-sm">
        Seisen Hub
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-100",
                isActive
                  ? "bg-[#404249] text-white"
                  : "text-[#B5BAC1] hover:bg-[#383A40] hover:text-white"
              )}
            >
              <Icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

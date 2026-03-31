"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Header({ activeGuildId }: { activeGuildId: string | null }) {
  const [guilds, setGuilds] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/guilds_proxy")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const adminGuilds = data.filter((g: any) => {
            const perms = BigInt(g.permissions);
            return (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);
          });
          setGuilds(adminGuilds);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#1E1F22] bg-[#313338] px-6 shadow-sm">
      <div className="flex items-center gap-4">
        {activeGuildId ? (
          <select 
            className="rounded-md border border-[#1E1F22] bg-[#2B2D31] px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-discord-blurple"
            value={activeGuildId}
            onChange={(e) => {
              const val = e.target.value;
              if (val) router.push(`/dashboard/${val}/autoreply`);
            }}
          >
            <option value="" disabled>Select a server</option>
            {guilds.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
            {/* Fallback if active guild isn't loaded yet but we are on it */}
            {!guilds.find(g => g.id === activeGuildId) && <option value={activeGuildId}>Loading Guild {activeGuildId}...</option>}
          </select>
        ) : (
          <div className="text-sm font-semibold text-[#B5BAC1]">
             Select a Guild
          </div>
        )}
      </div>
      <div>
        <Link 
          href="/api/auth/discord/logout"
          className="rounded-md border border-[#1E1F22] bg-[#2B2D31] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-discord-red"
        >
          Logout
        </Link>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { ChevronRightIcon, LogOutIcon, MenuIcon } from "lucide-react";

export default function Header({
  showMenuButton,
  onOpenSidebar,
}: {
  showMenuButton?: boolean;
  onOpenSidebar?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1320]/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex w-full max-w-[1520px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showMenuButton && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#122033] text-discord-text transition hover:bg-[#18304a] lg:hidden"
              aria-label="Open sidebar"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          )}

          <Link
            href="/"
            className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#0f1c2b]/80 px-3 py-2 transition hover:border-discord-blurple/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-discord-blurple to-[#4ea7ff] text-sm font-black text-white shadow-[0_6px_16px_rgba(45,196,183,0.35)]">
              S
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white">Seisen Hub</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-discord-text-muted">Bot Control</p>
            </div>
            <ChevronRightIcon className="hidden h-4 w-4 text-discord-text-muted transition group-hover:text-discord-blurple sm:block" />
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <a
            href="/api/auth/discord/logout"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#122033] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-discord-text transition hover:border-discord-red/40 hover:bg-discord-red/20 hover:text-white"
          >
            <LogOutIcon className="h-4 w-4" />
            Logout
          </a>
        </div>
      </div>
    </header>
  );
}

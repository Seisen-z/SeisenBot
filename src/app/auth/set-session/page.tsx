"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircleIcon, ShieldCheckIcon } from "lucide-react";

function SetSessionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("t");
    const userId = searchParams.get("u");

    if (!token || !userId) {
      router.replace("/login?error=no_session");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/establish-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token, user_id: userId }),
        });
        if (!res.ok) {
          router.replace("/login?error=no_session");
          return;
        }
        try {
          sessionStorage.setItem("seisenAuth", "1");
        } catch {
          /* ignore */
        }
        router.replace("/");
      } catch {
        router.replace("/login?error=no_session");
      }
    })();
  }, [searchParams, router]);

  return (
    <div className="fixed inset-0 grid place-items-center px-4 py-10">
      <div className="glass-card page-enter mx-auto w-full max-w-md rounded-3xl px-8 py-9 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-discord-blurple/20 text-discord-blurple">
          <LoaderCircleIcon className="h-6 w-6 animate-spin" />
        </div>

        <h2 className="text-2xl font-bold text-white">Finalizing OAuth Session</h2>
        <p className="mt-2 text-sm text-discord-text-muted">Syncing your Discord identity and preparing dashboard access.</p>

        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-discord-green/35 bg-discord-green/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8ef2ca]">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          Secure Handshake In Progress
        </div>
      </div>
    </div>
  );
}

export default function SetSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 grid place-items-center px-4">
          <div className="glass-card mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm text-discord-text-muted">
            <LoaderCircleIcon className="h-4 w-4 animate-spin text-discord-blurple" />
            Loading authentication state...
          </div>
        </div>
      }
    >
      <SetSessionInner />
    </Suspense>
  );
}

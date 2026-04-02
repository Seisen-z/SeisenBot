"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2Icon, LoaderCircleIcon, ShieldAlertIcon } from "lucide-react";

type VerifyState = "checking" | "redirecting" | "success" | "error";

function hasDiscordSessionCookie() {
  return /(^| )session_token=([^;]+)/.test(document.cookie);
}

function isDiscordSnowflake(value: string) {
  return /^\d{17,20}$/.test(value);
}

export default function VerifyGuildPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = typeof params.guildId === "string" ? params.guildId : "";

  const [state, setState] = useState<VerifyState>("checking");
  const [message, setMessage] = useState("Verifying your Discord identity...");
  const [redirectUrl, setRedirectUrl] = useState<string>("https://discord.com/channels/@me");
  const didRunRef = useRef(false);

  const loginHref = useMemo(() => {
    if (!isDiscordSnowflake(guildId)) return "/login";
    return `/api/auth/discord/login?next=${encodeURIComponent(`/verify/${guildId}`)}`;
  }, [guildId]);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    if (!isDiscordSnowflake(guildId)) {
      setState("error");
      setMessage("Invalid verification link. Ask a staff member for a new verification button.");
      return;
    }

    if (!hasDiscordSessionCookie()) {
      setState("redirecting");
      setMessage("Redirecting to Discord login for secure verification...");
      window.location.href = loginHref;
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch("/api/verification/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guildId }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(data?.message || `Verification failed (${res.status})`));
        }

        const nextUrl = String(data?.redirect_url || "").trim();
        if (nextUrl.startsWith("https://discord.com/channels/")) {
          setRedirectUrl(nextUrl);
        } else if (isDiscordSnowflake(guildId)) {
          setRedirectUrl(`https://discord.com/channels/${guildId}`);
        }

        setState("success");
        setMessage("Verification complete. Opening your Discord server...");
      } catch (err) {
        setState("error");
        setMessage(err instanceof Error ? err.message : "Verification failed. Please try again.");
      }
    };

    verify();
  }, [guildId, loginHref]);

  useEffect(() => {
    if (state !== "success") return;
    const nextUrl = redirectUrl.startsWith("https://discord.com/channels/")
      ? redirectUrl
      : (isDiscordSnowflake(guildId) ? `https://discord.com/channels/${guildId}` : "https://discord.com/channels/@me");
    const timer = window.setTimeout(() => {
      window.location.href = nextUrl;
    }, 900);
    return () => window.clearTimeout(timer);
  }, [state, redirectUrl, guildId]);

  return (
    <div className="fixed inset-0 grid place-items-center px-4 py-10">
      <div className="glass-card page-enter mx-auto w-full max-w-xl rounded-3xl px-7 py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-discord-blurple/20 text-discord-blurple">
          {state === "success" ? (
            <CheckCircle2Icon className="h-6 w-6 text-discord-green" />
          ) : state === "error" ? (
            <ShieldAlertIcon className="h-6 w-6 text-discord-red" />
          ) : (
            <LoaderCircleIcon className="h-6 w-6 animate-spin" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-white">
          {state === "success" ? "Verification Complete" : "Secure Verification"}
        </h1>
        <p className="mt-2 text-sm text-discord-text-muted">{message}</p>

        {state === "error" && (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a
              href={loginHref}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-discord-blurple px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Login and Verify
            </a>
            <a
              href={isDiscordSnowflake(guildId) ? `https://discord.com/channels/${guildId}` : "https://discord.com/channels/@me"}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-discord-text transition hover:border-white/35 hover:text-white"
            >
              Open Discord
            </a>
          </div>
        )}

        {state === "success" && (
          <div className="mt-5">
            <a
              href={redirectUrl.startsWith("https://discord.com/channels/") ? redirectUrl : (isDiscordSnowflake(guildId) ? `https://discord.com/channels/${guildId}` : "https://discord.com/channels/@me")}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-discord-green px-4 text-sm font-semibold text-[#072016] transition hover:brightness-110"
            >
              Continue in Discord
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

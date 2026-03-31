"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 1 week in seconds

function setCookie(name: string, value: string, maxAge: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export default function SetSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("t");
    const userId = searchParams.get("u");

    if (token && userId) {
      // Set cookies client-side — 100% reliable cross-platform.
      // The browser sends these in the Cookie header on every request,
      // so the middleware and server components can read them normally.
      setCookie("session_token", token, COOKIE_MAX_AGE);
      setCookie("user_id", userId, COOKIE_MAX_AGE);

      // Replace so the token doesn't stay in browser history
      router.replace("/");
    } else {
      router.replace("/login?error=no_session");
    }
  }, [searchParams, router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#1a1b1e",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #5865F2",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "#B5BAC1", fontSize: 14, fontFamily: "sans-serif" }}>
        Logging you in…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/discord/callback";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 1 week

function normalizeNextPath(rawPath?: string | null) {
  if (!rawPath) return "/";

  const tryPath = (candidate: string) => {
    if (candidate.startsWith("/") && !candidate.startsWith("//")) {
      return candidate;
    }
    return "/";
  };

  try {
    return tryPath(decodeURIComponent(rawPath));
  } catch {
    return tryPath(rawPath);
  }
}

function encodeOAuthState(nextPath: string) {
  const payload = JSON.stringify({ next: normalizeNextPath(nextPath) });
  return Buffer.from(payload, "utf8").toString("base64url");
}

function decodeOAuthState(rawState?: string | null) {
  if (!rawState) return "/";

  try {
    const decoded = Buffer.from(rawState, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return normalizeNextPath(parsed?.next);
  } catch {
    return "/";
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ discord: string[] }> }) {
  const resolvedParams = await params;
  const action = resolvedParams.discord[resolvedParams.discord.length - 1];

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  if (action === "login") {
    const scope = encodeURIComponent("identify guilds");
    const nextPath = normalizeNextPath(req.nextUrl.searchParams.get("next"));
    const state = encodeOAuthState(nextPath);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;
    return NextResponse.redirect(authUrl);
  }

  // ─── CALLBACK ─────────────────────────────────────────────────────────────
  if (action === "callback") {
    const url = new URL(req.url);
    const oauthError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const nextPath = decodeOAuthState(url.searchParams.get("state"));

    if (oauthError) {
      return NextResponse.redirect(new URL(`/login?error=auth_failed&next=${encodeURIComponent(nextPath)}`, req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/login?error=no_code&next=${encodeURIComponent(nextPath)}`, req.url));
    }

    try {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("Missing Discord OAuth credentials");
      }

      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID!,
          client_secret: CLIENT_SECRET!,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || "Failed to obtain access token");
      }

      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userRes.ok) {
        throw new Error(`Failed to fetch Discord user (${userRes.status})`);
      }

      const userData = await userRes.json();

      if (!userData?.id) {
        throw new Error("Discord user id missing from OAuth response");
      }

      const response = NextResponse.redirect(new URL(nextPath, req.url));
      response.cookies.set("session_token", tokenData.access_token, {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
      });
      response.cookies.set("user_id", String(userData.id), {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
      });

      return response;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.info("Auth callback error", err);
      }
      return NextResponse.redirect(new URL(`/login?error=auth_failed&next=${encodeURIComponent(nextPath)}`, req.url));
    }
  }

  // ─── LOGOUT ───────────────────────────────────────────────────────────────
  if (action === "logout") {
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.set("session_token", "", { maxAge: 0, path: "/" });
    response.cookies.set("user_id", "", { maxAge: 0, path: "/" });
    return response;
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 1 week

function resolveRedirectUri(req: NextRequest) {
  const raw = process.env.DISCORD_REDIRECT_URI?.trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "0.0.0.0") {
        return raw;
      }
    } catch {
      // Ignore malformed env value and fall back to request origin.
    }
  }

  return `${req.nextUrl.origin}/api/auth/discord/callback`;
}

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
    const redirectUri = resolveRedirectUri(req);
    const nextPath = normalizeNextPath(req.nextUrl.searchParams.get("next"));
    const state = encodeOAuthState(nextPath);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;
    return NextResponse.redirect(authUrl);
  }

  // ─── CALLBACK ─────────────────────────────────────────────────────────────
  if (action === "callback") {
    const url = new URL(req.url);
    const oauthError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const nextPath = decodeOAuthState(url.searchParams.get("state"));
    const redirectUri = resolveRedirectUri(req);

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
          redirect_uri: redirectUri,
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

      const handoffUrl = new URL("/auth/set-session", req.url);
      handoffUrl.searchParams.set("t", tokenData.access_token);
      handoffUrl.searchParams.set("u", String(userData.id));

      if (nextPath && nextPath !== "/") {
        handoffUrl.searchParams.set("next", nextPath);
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[OAuth Callback] Redirecting to session handoff", {
          host: req.nextUrl.hostname,
          userId: userData.id,
          nextPath,
        });
      }

      return NextResponse.redirect(handoffUrl);
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
    const isSecureContext = req.nextUrl.protocol === "https:";
    const cookieOptions = {
      maxAge: 0,
      path: "/",
      sameSite: "lax" as const,
      secure: isSecureContext,
      httpOnly: true,
    };
    
    response.cookies.set("session_token", "", cookieOptions);
    response.cookies.set("user_id", "", cookieOptions);
    return response;
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
 

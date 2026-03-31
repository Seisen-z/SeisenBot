import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/discord/callback";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 1 week in seconds

export async function GET(req: NextRequest, { params }: { params: Promise<{ discord: string[] }> }) {
  const resolvedParams = await params;
  const actionPath = resolvedParams.discord;
  const action = actionPath[actionPath.length - 1];

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  if (action === "login") {
    const scope = encodeURIComponent("identify guilds");
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}&prompt=none`;
    return NextResponse.redirect(authUrl);
  }

  // ─── CALLBACK ─────────────────────────────────────────────────────────────
  if (action === "callback") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(new URL("/login?error=no_code", req.url));
    }

    try {
      // Exchange code for token
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
      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      // Fetch user info
      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();

      // Build redirect response and attach cookies directly to it
      const response = NextResponse.redirect(new URL("/", req.url));

      response.cookies.set("session_token", tokenData.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });

      response.cookies.set("user_id", userData.id, {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });

      return response;
    } catch (err) {
      console.error("Auth callback error:", err);
      return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
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

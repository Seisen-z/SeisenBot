import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/discord/callback";

export async function GET(req: NextRequest, { params }: { params: Promise<{ discord: string[] }> }) {
  const resolvedParams = await params;
  const actionPath = resolvedParams.discord;
  // Use the LAST segment so /api/auth/discord/login -> action = 'login'
  const action = actionPath[actionPath.length - 1];

  if (action === "login") {
    const scope = encodeURIComponent("identify guilds");
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}&prompt=none`;
    return NextResponse.redirect(authUrl);
  }

  if (action === "callback") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    // Handle user cancelling auth
    if (!code) {
      return NextResponse.redirect(new URL("/login?error=no_code", req.url));
    }

    try {
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID!,
          client_secret: CLIENT_SECRET!,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI
        })
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      // fetch user to get their ID to store
      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { "Authorization": `Bearer ${tokenData.access_token}` }
      });
      const userData = await userRes.json();

      const response = NextResponse.redirect(new URL("/", req.url));
      
      response.cookies.set("session_token", tokenData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });
      response.cookies.set("user_id", userData.id, { path: "/", maxAge: 60 * 60 * 24 * 7 });

      return response;
    } catch (err) {
      console.error("Auth error", err);
      return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
    }
  }

  if (action === "logout") {
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("session_token");
    response.cookies.delete("user_id");
    return response;
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

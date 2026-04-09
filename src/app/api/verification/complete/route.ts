import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function decodeCookieToken(value: string | undefined) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveApiBase(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const envApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!envApi) {
    return `${origin}/api/bot`;
  }

  if (envApi.startsWith("/")) {
    return `${origin}${envApi}`.replace(/\/$/, "");
  }

  try {
    const parsed = new URL(envApi);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return `${origin}/api/bot`;
    }
    return envApi.replace(/\/$/, "");
  } catch {
    return `${origin}/api/bot`;
  }
}

function isDiscordSnowflake(value: string) {
  return /^\d{17,20}$/.test(value);
}

async function readErrorMessage(response: Response) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (String(data?.error || "") === "BOT_API_UNAVAILABLE") {
        const detailText = String(data?.detail || "").toLowerCase();
        if (detailText.includes("aborted")) {
          return "Verification is still finishing in Discord. Please wait a few seconds and try again.";
        }
      }
      return data?.message || data?.detail || data?.error || JSON.stringify(data);
    }
    return (await response.text()).trim();
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  let guildId = "";
  try {
    const body = await request.json();
    guildId = String(body?.guildId || "").trim();
  } catch {
    return NextResponse.json({ message: "Invalid request payload." }, { status: 400 });
  }

  if (!isDiscordSnowflake(guildId)) {
    return NextResponse.json({ message: "Invalid guild id." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = decodeCookieToken(cookieStore.get("session_token")?.value);
  const cookieUserId = decodeCookieToken(cookieStore.get("user_id")?.value);

  if (!token || !cookieUserId) {
    return NextResponse.json({ message: "Login required. Please sign in with Discord." }, { status: 401 });
  }

  let discordUserRes: Response;
  try {
    discordUserRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ message: "Could not validate with Discord right now. Please try again." }, { status: 503 });
  }

  if (!discordUserRes.ok) {
    return NextResponse.json({ message: "Discord session expired. Please sign in again." }, { status: 401 });
  }

  const discordUser = await discordUserRes.json();
  const oauthUserId = String(discordUser?.id || "");

  if (!isDiscordSnowflake(oauthUserId)) {
    return NextResponse.json({ message: "Could not validate Discord account." }, { status: 401 });
  }

  if (oauthUserId !== String(cookieUserId)) {
    return NextResponse.json({ message: "Discord account mismatch. Please sign in again." }, { status: 401 });
  }

  const apiBase = resolveApiBase(request);
  let triggerRes: Response;
  try {
    triggerRes = await fetch(`${apiBase}/trigger/verify_member_web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify({
        guild_id: guildId,
        payload: {
          user_id: oauthUserId,
        },
      }),
    });
  } catch {
    return NextResponse.json(
      { message: "Verification backend is currently unavailable. Please try again in a moment." },
      { status: 503 },
    );
  }

  if (!triggerRes.ok) {
    const detail = await readErrorMessage(triggerRes);
    return NextResponse.json(
      {
        message: detail || "Verification failed. Please try again.",
      },
      { status: triggerRes.status },
    );
  }

  const data = await triggerRes.json().catch(() => ({}));
  const redirectUrl = String(data?.discord_redirect_url || `https://discord.com/channels/${guildId}`);
  return NextResponse.json({
    status: "success",
    message: String(data?.message || "You are now verified. Return to Discord."),
    redirect_url: redirectUrl,
  });
}

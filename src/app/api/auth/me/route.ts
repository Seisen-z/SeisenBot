import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function decodeCookieToken(value: string | undefined) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const token = decodeCookieToken(cookieStore.get("session_token")?.value);

  if (!token) {
    return NextResponse.json({ message: "Unauthorized - No session token" }, { status: 401 });
  }

  try {
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.log(`[/api/auth/me] Discord API failed with status: ${response.status}`);
      const status = response.status === 401 ? 401 : 502;
      const errorMsg = response.status === 401 ? "Discord token expired" : "Failed to fetch Discord user";
      return NextResponse.json({ message: errorMsg }, { status });
    }

    const data = await response.json();
    return NextResponse.json({
      id: String(data?.id || ""),
      username: String(data?.username || ""),
      global_name: String(data?.global_name || ""),
      avatar: String(data?.avatar || ""),
    });
  } catch (error) {
    console.error("[/api/auth/me] Error:", error);
    return NextResponse.json({ message: "Discord user lookup unavailable" }, { status: 503 });
  }
}

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
    console.error("[guilds_proxy] No session token found in cookies");
    return NextResponse.json({ 
      error: "Unauthorized", 
      message: "Please log in again" 
    }, { status: 401 });
  }

  try {
    const res = await fetch("https://discord.com/api/users/@me/guilds?with_counts=true", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { revalidate: 60 }
    });
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    
    // Token might be expired
    if (res.status === 401) {
      console.error("[guilds_proxy] Discord OAuth token expired or invalid");
      return NextResponse.json({ 
        error: "Unauthorized", 
        message: "Session expired. Please log in again." 
      }, { status: 401 });
    }
    
    console.error(`[guilds_proxy] Discord API error: ${res.status}`);
    return NextResponse.json({ error: "Failed to fetch guilds" }, { status: res.status });
  } catch (err) {
    console.error("[guilds_proxy] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

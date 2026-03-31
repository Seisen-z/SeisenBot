import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { revalidate: 60 }
    });
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    
    return NextResponse.json({ error: "Failed to fetch" }, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

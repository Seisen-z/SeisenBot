import { NextRequest, NextResponse } from "next/server";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
  let body: { token?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = String(body?.token || "").trim();
  const userId = String(body?.user_id || "").trim();

  if (!token || !userId) {
    return NextResponse.json({ error: "token and user_id required" }, { status: 400 });
  }

  const isSecureContext = req.nextUrl.protocol === "https:";
  const cookieOptions = {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: isSecureContext,
    httpOnly: true,
  };

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session_token", token, cookieOptions);
  res.cookies.set("user_id", userId, cookieOptions);
  return res;
}

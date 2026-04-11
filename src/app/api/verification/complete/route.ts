import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeBase(base: string): string {
  return String(base || "").trim().replace(/\/+$/, "");
}

function resolvePrimaryBotApiBase(): string {
  const raw = process.env.API_PROXY_TARGET || process.env.BOT_API_URL || "http://127.0.0.1:8000";
  const first = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)[0];
  const cleaned = normalizeBase(first || "");
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  const host = cleaned.replace(/^\/+/, "");
  return normalizeBase(`http://${host}`);
}

function formatFastApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (entry && typeof entry === "object" && "msg" in entry) {
          return String((entry as { msg?: string }).msg || entry);
        }
        return JSON.stringify(entry);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }
  return "Verification failed.";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    guildId?: string;
    challenge?: string;
  };
  const guildId = String(body.guildId || "").trim();
  const challenge = String(body.challenge || "").trim();

  if (!/^\d{17,20}$/.test(guildId)) {
    return NextResponse.json({ message: "Invalid verification link (guild)." }, { status: 400 });
  }

  if (!challenge) {
    return NextResponse.json({ message: "Missing verification token." }, { status: 400 });
  }

  const base = resolvePrimaryBotApiBase();
  const timeoutMs = Number(process.env.BOT_API_VERIFY_TIMEOUT_MS || "90000");

  const secret = process.env.VERIFICATION_INTERNAL_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { message: "Verification is not configured (missing VERIFICATION_INTERNAL_SECRET)." },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/internal/verification/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ guild_id: guildId, challenge }),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      redirect_url?: string;
      message?: string;
      detail?: unknown;
    };
    if (!res.ok) {
      const msg = formatFastApiDetail(data.detail) || data.message || `Verification failed (${res.status})`;
      return NextResponse.json({ message: msg }, { status: res.status });
    }
    return NextResponse.json({
      redirect_url: data.redirect_url,
      message: data.message,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification request failed.";
    return NextResponse.json({ message: msg }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const preferredRegion = ["fra1"];
export const maxDuration = 60;

const API_TIMEOUT_MS = Number(process.env.BOT_API_TIMEOUT_MS || "45000");
const VERIFY_API_TIMEOUT_MS = Number(process.env.BOT_API_VERIFY_TIMEOUT_MS || "90000");
const DEFAULT_BOT_API_BASE = "http://127.0.0.1:8000";
const ENABLE_PROTOCOL_FALLBACK = String(process.env.BOT_API_ENABLE_PROTOCOL_FALLBACK || "0").trim() === "1";

function resolveRequestTimeoutMs(path: string[] | undefined) {
  const safePath = Array.isArray(path) ? path : [];
  const triggerIndex = safePath.findIndex((segment) => segment === "trigger");
  const action = triggerIndex >= 0 ? safePath[triggerIndex + 1] : "";

  if (action === "verify_member_web") {
    return VERIFY_API_TIMEOUT_MS;
  }

  return API_TIMEOUT_MS;
}

function normalizeBase(base: string): string {
  return String(base || "").trim().replace(/\/+$/, "");
}

function parseCandidateBases(rawValue: string | undefined): string[] {
  const raw = String(rawValue || "").trim();
  if (!raw) return [];

  return raw
    .split(/[\s,]+/)
    .map((entry) => normalizeBase(entry))
    .filter(Boolean);
}

function expandBaseVariants(base: string): string[] {
  const cleaned = normalizeBase(base);
  if (!cleaned) return [];

  if (/^https?:\/\//i.test(cleaned)) {
    const variants = [cleaned];

    if (!ENABLE_PROTOCOL_FALLBACK) {
      return variants;
    }

    try {
      const parsed = new URL(cleaned);
      const host = parsed.hostname.toLowerCase();
      if (host !== "127.0.0.1" && host !== "localhost") {
        const alternateProtocol = parsed.protocol === "https:" ? "http:" : "https:";
        variants.push(normalizeBase(`${alternateProtocol}//${parsed.host}${parsed.pathname}`));
      }
    } catch {
      // Keep original variant only when URL parsing fails.
    }

    return variants;
  }

  const hostWithPort = cleaned.replace(/^\/+/, "");
  if (!hostWithPort) return [];
  return [normalizeBase(`https://${hostWithPort}`), normalizeBase(`http://${hostWithPort}`)];
}

function uniqueBases(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const cleaned = normalizeBase(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

function resolveBotApiBases(): string[] {
  const configured = [
    ...parseCandidateBases(process.env.BOT_API_URL),
    ...parseCandidateBases(process.env.API_PROXY_TARGET),
  ];

  const baseCandidates = configured.length > 0 ? configured : [DEFAULT_BOT_API_BASE];
  const expanded = baseCandidates.flatMap((base) => expandBaseVariants(base));
  const deduped = uniqueBases(expanded);

  return deduped.length > 0 ? deduped : [DEFAULT_BOT_API_BASE];
}

function buildTargetUrl(base: string, request: NextRequest, path: string[] | undefined) {
  const suffix = (path || []).map((segment) => encodeURIComponent(segment)).join("/");
  const apiPath = suffix ? `/api/${suffix}` : "/api";
  return `${normalizeBase(base)}${apiPath}${request.nextUrl.search}`;
}

function decodeCookieToken(value: string | undefined) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function clearSessionCookies(response: NextResponse, secure: boolean) {
  const cookieOptions = {
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure,
    httpOnly: true,
  };
  response.cookies.set("session_token", "", cookieOptions);
  response.cookies.set("user_id", "", cookieOptions);
}

function buildForwardHeaders(request: NextRequest, sessionToken?: string) {
  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "content-length") {
      continue;
    }
    headers.set(key, value);
  }

  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  return headers;
}

async function proxyToBotApi(request: NextRequest, path: string[] | undefined) {
  const timeoutMs = resolveRequestTimeoutMs(path);
  const targetBases = resolveBotApiBases();
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  const errors: Array<{ target: string; detail: string }> = [];

  const cookieStore = await cookies();
  const sessionFromCookie = decodeCookieToken(cookieStore.get("session_token")?.value);
  const forwardHeaders = buildForwardHeaders(request, sessionFromCookie);

  for (const base of targetBases) {
    const targetUrl = buildTargetUrl(base, request, path);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body,
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      });

      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("transfer-encoding");

      const response = new NextResponse(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
      if (upstream.status === 401) {
        clearSessionCookies(response, request.nextUrl.protocol === "https:");
      }
      return response;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown proxy error";
      errors.push({ target: base, detail });
    } finally {
      clearTimeout(timeout);
    }
  }

  const primaryError = errors[0];
  return NextResponse.json(
    {
      error: "BOT_API_UNAVAILABLE",
      message: "Bot API is currently unreachable.",
      detail: primaryError?.detail || "Unknown proxy error",
      target: primaryError?.target || targetBases[0] || DEFAULT_BOT_API_BASE,
      timeout_ms: timeoutMs,
      attempted_targets: targetBases,
    },
    { status: 503 },
  );
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBotApi(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBotApi(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBotApi(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBotApi(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBotApi(request, path);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBotApi(request, path);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBotApi(request, path);
}

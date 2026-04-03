import { NextRequest, NextResponse } from "next/server";

const API_TIMEOUT_MS = Number(process.env.BOT_API_TIMEOUT_MS || "15000");

function resolveBotApiBase() {
  const configured = (process.env.BOT_API_URL || process.env.API_PROXY_TARGET || "").trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  // Keep a deterministic local fallback for development if env vars are missing.
  return "http://127.0.0.1:8000";
}

function buildTargetUrl(request: NextRequest, path: string[] | undefined) {
  const base = resolveBotApiBase();
  const suffix = (path || []).map((segment) => encodeURIComponent(segment)).join("/");
  const apiPath = suffix ? `/api/${suffix}` : "/api";
  return `${base}${apiPath}${request.nextUrl.search}`;
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "content-length") {
      continue;
    }
    headers.set(key, value);
  }

  return headers;
}

async function proxyToBotApi(request: NextRequest, path: string[] | undefined) {
  const targetUrl = buildTargetUrl(request, path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: buildForwardHeaders(request),
      body,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown proxy error";
    return NextResponse.json(
      {
        error: "BOT_API_UNAVAILABLE",
        message: "Bot API is currently unreachable.",
        detail,
        target: resolveBotApiBase(),
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
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

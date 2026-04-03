const DEFAULT_API_BASE = "/api/bot";

function normalizeApiBase(rawBase: string | undefined): string {
  const trimmed = String(rawBase || "").trim();
  if (!trimmed) return DEFAULT_API_BASE;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = String(endpoint || "").trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function looksLikeReactFlightPayload(text: string): boolean {
  const probe = text.slice(0, 400);
  return (
    probe.includes("$Sreact.fragment") ||
    probe.includes("ClientPageRoot") ||
    probe.includes("MetadataBoundary") ||
    /^\d+:\"\$Sreact\./.test(probe)
  );
}

function summarizeBody(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  if (looksLikeReactFlightPayload(normalized)) {
    return "Received a Next.js page payload instead of API JSON. Check NEXT_PUBLIC_API_URL and /api/bot proxy route configuration.";
  }

  return normalized.slice(0, 320);
}

const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE);

export async function fetchApi(endpoint: string, jwt?: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`);
  }

  const res = await fetch(`${API_BASE}${normalizeEndpoint(endpoint)}`, {
    ...init,
    headers,
    credentials: 'include', // Ensure cookies are sent with requests
  });

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJsonResponse = contentType.includes('application/json');

  if (!res.ok) {
    let details = '';

    try {
      if (isJsonResponse) {
        const data = await res.json();
        details = data?.detail || data?.message || JSON.stringify(data);
      } else {
        details = summarizeBody(await res.text());
      }
    } catch {
      // Ignore parse failures and fall back to status text only.
    }

    throw new Error(`API Error ${res.status}: ${details || res.statusText}`);
  }

  if (res.status === 204) {
    return null;
  }

  if (!isJsonResponse) {
    const payload = summarizeBody(await res.text());
    const renderedType = contentType || 'unknown content type';
    throw new Error(
      `API Error ${res.status}: Expected JSON response but received ${renderedType}.${payload ? ` ${payload}` : ''}`
    );
  }

  return await res.json();
}

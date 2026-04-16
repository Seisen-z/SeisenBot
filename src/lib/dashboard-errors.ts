export type DashboardErrorState = {
  message: string;
  needsRelogin?: boolean;
};

export function toDashboardErrorState(error: unknown, fallback: string): DashboardErrorState {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const message = rawMessage.toLowerCase();
  const status = typeof error === "object" && error !== null && "status" in error ? (error as any).status : undefined;

  if (status === 401 || status === 403 || message.includes("api error 401") || message.includes("api error 403")) {
    return {
      message: "Session expired or access changed. Please login again and retry.",
      needsRelogin: true,
    };
  }

  if (status === 429 || message.includes("api error 429")) {
    return {
      message: "Rate limited by upstream API. Please wait a moment and retry.",
    };
  }

  if (status === 503 || status === 502 || message.includes("api error 503") || message.includes("api error 502")) {
    return {
      message: "Bot API is temporarily unavailable. Retry in a moment.",
    };
  }

  if (message.includes("api network error")) {
    return {
      message: "Network/API connection failed. Check bot API availability and retry.",
    };
  }

  // Allow custom API error messages (from fetchApi) to bubble up if available,
  // instead of generically failing with the fallback.
  if (status && status !== 500 && error instanceof Error && error.message) {
      return { message: error.message };
  }

  return { message: fallback };
}

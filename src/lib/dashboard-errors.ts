export type DashboardErrorState = {
  message: string;
  needsRelogin?: boolean;
};

export function toDashboardErrorState(error: unknown, fallback: string): DashboardErrorState {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const message = rawMessage.toLowerCase();

  if (message.includes("api error 401") || message.includes("api error 403")) {
    return {
      message: "Session expired or access changed. Please login again and retry.",
      needsRelogin: true,
    };
  }

  if (message.includes("api error 429")) {
    return {
      message: "Rate limited by upstream API. Please wait a moment and retry.",
    };
  }

  if (message.includes("api error 503") || message.includes("api error 502")) {
    return {
      message: "Bot API is temporarily unavailable. Retry in a moment.",
    };
  }

  if (message.includes("api network error")) {
    return {
      message: "Network/API connection failed. Check bot API availability and retry.",
    };
  }

  return { message: fallback };
}

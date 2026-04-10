"use client";

import { AlertTriangleIcon, RefreshCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardErrorBanner({
  message,
  onRetry,
  retryLabel = "Retry",
  actionLabel,
  actionHref,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-white/80" />
          <p className="truncate text-sm text-white/90">{message}</p>
        </div>
        <div className="flex items-center gap-2">
          {actionHref && actionLabel && (
            <a
              href={actionHref}
              className="inline-flex h-8 items-center rounded-md border border-white/15 px-2.5 text-xs text-white/90 transition hover:border-white/35 hover:bg-white/10"
            >
              {actionLabel}
            </a>
          )}
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RefreshCcwIcon className="h-3.5 w-3.5" />
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

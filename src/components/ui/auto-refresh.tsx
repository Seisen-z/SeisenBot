"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Triggers router.refresh() once on mount so the server re-fetches fresh data,
 * bypassing Next.js client-side router cache without requiring a hard reload.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, []);

  return null;
}

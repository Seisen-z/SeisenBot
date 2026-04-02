"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircleIcon } from "lucide-react";

interface CenteredLoadingOverlayProps {
  title: string;
  description: string;
  zIndex?: number;
}

export function CenteredLoadingOverlay({
  title,
  description,
  zIndex = 50,
}: CenteredLoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const overlay = useMemo(
    () => (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex,
          display: "grid",
          placeItems: "center",
          padding: "1rem",
        }}
      >
        <div className="glass-card page-enter w-full max-w-md rounded-3xl px-8 py-9 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-discord-blurple/20 text-discord-blurple">
            <LoaderCircleIcon className="h-6 w-6 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="mt-2 text-sm text-discord-text-muted">{description}</p>
        </div>
      </div>
    ),
    [description, title, zIndex]
  );

  if (!mounted || typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
}

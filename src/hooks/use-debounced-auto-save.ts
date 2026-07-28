"use client";

import { useEffect, useRef } from "react";

interface UseDebouncedAutoSaveOptions<T> {
  value: T;
  enabled: boolean;
  contextKey?: string | number;
  delay?: number;
  onSave: (value: T) => Promise<void> | void;
  onError?: (error: unknown) => void;
}

export function useDebouncedAutoSave<T>({
  value,
  enabled,
  contextKey = "default",
  delay = 1500,
  onSave,
  onError,
}: UseDebouncedAutoSaveOptions<T>) {
  const isFirstRunRef = useRef(true);
  const contextRef = useRef<string | number>(contextKey);
  const onSaveRef = useRef(onSave);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (contextRef.current !== contextKey) {
      contextRef.current = contextKey;
      isFirstRunRef.current = true;
    }
  }, [contextKey]);

  useEffect(() => {
    if (!enabled) return;

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      Promise.resolve(onSaveRef.current(value)).catch((error) => {
        if (onErrorRef.current) onErrorRef.current(error);
      });
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [value, enabled, delay]);
}

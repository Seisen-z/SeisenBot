"use client";

import { useEffect, useRef, useState } from "react";

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
  delay = 600,
  onSave,
  onError,
}: UseDebouncedAutoSaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const isFirstRunRef = useRef(true);
  const contextRef = useRef<string | number>(contextKey);
  const onSaveRef = useRef(onSave);
  const onErrorRef = useRef(onError);
  const latestValueRef = useRef(value);

  latestValueRef.current = value;

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
      setIsSaving(false);
      setLastSaved(null);
    }
  }, [contextKey]);

  const triggerSaveNow = async () => {
    setIsSaving(true);
    try {
      await onSaveRef.current(latestValueRef.current);
      setLastSaved(new Date());
    } catch (error) {
      if (onErrorRef.current) onErrorRef.current(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }

    setIsSaving(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        await onSaveRef.current(value);
        setLastSaved(new Date());
      } catch (error) {
        if (onErrorRef.current) onErrorRef.current(error);
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [value, enabled, delay]);

  // Flush pending changes before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled && !isFirstRunRef.current) {
        onSaveRef.current(latestValueRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);

  return { isSaving, lastSaved, triggerSaveNow };
}

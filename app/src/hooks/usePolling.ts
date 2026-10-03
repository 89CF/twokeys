"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Runs `fn` immediately and then every `intervalMs` (0 = once). Keeps the last good data on errors.
 * `key` changes reset the state.
 */
export function usePolling<T>(fn: (() => Promise<T>) | null, intervalMs: number, key: string): PollState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(!!fn);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const keyRef = useRef(key);

  const refresh = useCallback(async () => {
    const f = fnRef.current;
    if (!f) return;
    const k = keyRef.current;
    try {
      const result = await f();
      if (keyRef.current !== k) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (keyRef.current !== k) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (keyRef.current === k) setLoading(false);
    }
  }, []);

  useEffect(() => {
    keyRef.current = key;
    setData(undefined);
    setError(null);
    setLoading(!!fnRef.current);
    if (!fnRef.current) return;
    void refresh();
    if (!intervalMs) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [key, intervalMs, refresh]);

  return { data, error, loading, refresh };
}

import { useCallback, useEffect, useRef, useState } from "react";

interface UsePollingReturn {
  lastPolledAt: Date | null;
  isPolling: boolean;
}

export function usePolling(
  intervalMs: number,
  callback: () => Promise<void>,
  enabled: boolean,
): UsePollingReturn {
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const inFlightRef = useRef(false);
  const errorCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date without re-creating the interval
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const tick = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsPolling(true);

    try {
      await callbackRef.current();
      errorCountRef.current = 0;
      setLastPolledAt(new Date());
    } catch {
      errorCountRef.current += 1;
    } finally {
      inFlightRef.current = false;
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Compute effective interval with backoff (max 5 min)
    const effectiveInterval = Math.min(
      intervalMs * Math.pow(2, errorCountRef.current),
      5 * 60 * 1000,
    );

    intervalRef.current = setInterval(tick, effectiveInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs, tick]);

  return { lastPolledAt, isPolling };
}

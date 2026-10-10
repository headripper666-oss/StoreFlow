import { useEffect, useRef } from "react";

export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let released = false;

    navigator.wakeLock.request("screen").then((lock) => {
      if (released) {
        lock.release();
      } else {
        lockRef.current = lock;
      }
    }).catch(() => {
      // Wake Lock peut échouer si l'onglet perd le focus — silencieux
    });

    return () => {
      released = true;
      lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);
}

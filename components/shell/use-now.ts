"use client";
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};

/** Current time in whole seconds, ticking every second. null during server render and hydration, so times never mismatch. */
export function useNowSeconds(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
}

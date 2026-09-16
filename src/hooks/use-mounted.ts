"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * Returns false during SSR and the initial client render, then true once
 * hydrated. Used to gate client-only UI (e.g. reading persisted theme)
 * without calling setState inside an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

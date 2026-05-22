"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "bi.sidebar.collapsed";

type UseCollapsedSidebarReturn = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
};

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => {
    cb();
  });
}

function readStored(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStored(value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage failures (private mode, quota); UI keeps working.
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  let onStorage: ((event: StorageEvent) => void) | null = null;
  if (typeof window !== "undefined") {
    onStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        callback();
      }
    };
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined" && onStorage) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getClientSnapshot(): boolean {
  return readStored();
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Sidebar collapse preference, persisted in
 * `localStorage["bi.sidebar.collapsed"]`. SSR-safe — the server snapshot
 * is `false` (expanded) so the markup stays stable across the boundary.
 *
 * Mirrors the `useSyncExternalStore` shape used by the theme provider so
 * we never call `setState` inside an effect.
 */
export function useCollapsedSidebar(): UseCollapsedSidebarReturn {
  const collapsed = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const setCollapsed = useCallback((value: boolean) => {
    writeStored(value);
    notify();
  }, []);

  const toggle = useCallback(() => {
    writeStored(!readStored());
    notify();
  }, []);

  return { collapsed, toggle, setCollapsed };
}

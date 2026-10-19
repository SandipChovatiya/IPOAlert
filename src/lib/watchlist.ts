"use client";

import { useSyncExternalStore } from "react";

const KEY = "ipo-watchlist-v1";
const listeners = new Set<() => void>();
let cache: string[] | null = null;
const EMPTY: string[] = [];

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    cache = Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string").slice(0, 100) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

export function toggleWatch(slug: string) {
  const cur = read();
  write(cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Watched slugs (localStorage-backed; empty on the server). */
export function useWatchlist(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

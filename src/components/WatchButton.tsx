"use client";

import { toggleWatch, useWatchlist } from "@/lib/watchlist";

export default function WatchButton({ slug, name, compact = false }: { slug: string; name: string; compact?: boolean }) {
  const watched = useWatchlist().includes(slug);
  return (
    <button
      type="button"
      onClick={() => toggleWatch(slug)}
      aria-pressed={watched}
      aria-label={watched ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      className={compact ? "grid h-9 w-9 place-items-center rounded-full border border-border bg-surface transition hover:bg-surface-2" : "btn"}
      style={watched ? { color: "var(--upcoming)", borderColor: "var(--upcoming)" } : undefined}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={watched ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />
      </svg>
      {compact ? null : <span>{watched ? "Watching" : "Watch"}</span>}
    </button>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWatchlist } from "@/lib/watchlist";
import { timing } from "@/lib/format";

interface Item {
  slug: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  listingDate: string | null;
}

/** Banner for watched IPOs that close within 2 days / open within 1 day, plus optional browser notifications. */
export default function Reminders() {
  const watched = useWatchlist();
  const [items, setItems] = useState<Item[]>([]);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  useEffect(() => {
    if (!watched.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    const ctl = new AbortController();
    fetch(`/api/ipos?slugs=${encodeURIComponent(watched.join(","))}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : { ipos: [] }))
      .then((j: { ipos: Item[] }) => {
        const due = j.ipos.filter((i) => {
          const t = timing(i);
          return (i.status === "open" && t.days <= 2) || (i.status === "upcoming" && t.days <= 1);
        });
        setItems(due);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const day = new Date().toDateString();
          for (const i of due) {
            const key = `ipo-notified-${i.slug}-${day}`;
            try {
              if (localStorage.getItem(key)) continue;
              localStorage.setItem(key, "1");
            } catch {}
            new Notification(i.name, { body: timing(i).text });
          }
        }
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [watched]);

  if (!items.length && !(watched.length && perm === "default")) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4">
      {items.length ? (
        <div role="status" className="card flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 px-4 py-3" style={{ borderLeftColor: "var(--upcoming)" }}>
          <strong className="text-sm">Reminders</strong>
          {items.map((i) => (
            <Link key={i.slug} href={`/ipo/${i.slug}`} className="text-sm hover:underline">
              {i.name} <span className="text-muted">· {timing(i).text}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {watched.length && perm === "default" ? (
        <button className="btn mt-3" onClick={() => Notification.requestPermission().then(setPerm)}>
          Enable browser notifications for watched IPOs
        </button>
      ) : null}
    </div>
  );
}

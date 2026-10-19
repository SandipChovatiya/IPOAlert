"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge, TypeBadge } from "@/components/Badges";
import CompanyLogo from "@/components/CompanyLogo";
import WatchButton from "@/components/WatchButton";
import type { Ipo } from "@/lib/db";
import { fmtPriceBand, timing } from "@/lib/format";
import { useWatchlist } from "@/lib/watchlist";

export default function WatchlistPage() {
  const watched = useWatchlist();
  const [ipos, setIpos] = useState<Ipo[] | null>(null);

  useEffect(() => {
    if (!watched.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIpos([]);
      return;
    }
    const ctl = new AbortController();
    fetch(`/api/ipos?slugs=${encodeURIComponent(watched.join(","))}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : { ipos: [] }))
      .then((j: { ipos: Ipo[] }) => setIpos(j.ipos))
      .catch(() => {});
    return () => ctl.abort();
  }, [watched]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
        <p className="text-sm text-muted">Saved in this browser only. Turn on notifications to get reminded before an IPO closes.</p>
      </div>

      {ipos === null ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      ) : ipos.length ? (
        <ul className="space-y-3">
          {ipos.filter((i) => watched.includes(i.slug)).map((i) => (
            <li key={i.id} className="card flex flex-wrap items-center gap-4 p-4">
              <CompanyLogo src={i.logo} name={i.name} size={44} />
              <div className="min-w-0 flex-1">
                <Link href={`/ipo/${i.slug}`} className="font-semibold hover:underline">{i.name}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <StatusBadge status={i.status} />
                  <TypeBadge type={i.type} />
                  <span>{fmtPriceBand(i.priceRange)}</span>
                  <span>{timing(i).text}</span>
                </div>
              </div>
              <WatchButton slug={i.slug} name={i.name} compact />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card px-6 py-14 text-center">
          <p className="text-lg font-semibold">Your watchlist is empty</p>
          <p className="mt-1 text-sm text-muted">Tap the star on any IPO to follow it.</p>
          <Link href="/" className="btn btn-primary mt-4">Browse IPOs</Link>
        </div>
      )}
    </div>
  );
}

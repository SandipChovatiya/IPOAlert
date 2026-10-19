import Link from "next/link";
import IpoCard from "@/components/IpoCard";
import { listIpos, tabCounts } from "@/lib/db";
import { listQuerySchema } from "@/lib/schemas";
import { daysBetween, todayIST } from "@/lib/status";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "open", label: "Open now" },
  { id: "upcoming", label: "Upcoming" },
  { id: "closed", label: "Closed & listed" },
] as const;

function Tile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const q = listQuerySchema.parse(flat);

  const [ipos, counts, open] = await Promise.all([listIpos(q), tabCounts(), listIpos({ tab: "open" })]);
  const today = todayIST();
  const closingSoon = open.filter((i) => i.endDate && daysBetween(today, i.endDate) <= 2).length;

  const href = (tab: string) => {
    const p = new URLSearchParams();
    p.set("tab", tab);
    if (q.q) p.set("q", q.q);
    if (q.type !== "all") p.set("type", q.type);
    return `/?${p}`;
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Track every IPO, calmly.</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Price bands, dates, subscription status and company details for open, upcoming and closed issues — refreshed automatically each day.
        </p>
      </section>

      <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Open now" value={counts.open} hint="accepting bids" />
        <Tile label="Closing soon" value={closingSoon} hint="within 2 days" />
        <Tile label="Upcoming" value={counts.upcoming} hint="announced on NSE" />
        <Tile label="Archive" value={counts.closed} hint="closed & listed" />
      </section>

      <section aria-label="IPO list" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="IPO status" className="inline-flex rounded-xl border border-border bg-surface p-1">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={href(t.id)}
                role="tab"
                aria-selected={q.tab === t.id}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                  q.tab === t.id ? "bg-accent text-accent-contrast" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-xs opacity-70">{counts[t.id]}</span>
              </Link>
            ))}
          </div>

          <form method="get" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="tab" value={q.tab} />
            <label className="sr-only" htmlFor="q">Search IPOs</label>
            <input id="q" name="q" defaultValue={q.q} maxLength={80} placeholder="Search name or symbol" className="field w-52" />
            <label className="sr-only" htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue={q.type} className="field w-auto">
              <option value="all">All types</option>
              <option value="EQ">Mainboard</option>
              <option value="SME">SME</option>
              <option value="DEBT">Debt</option>
            </select>
            <label className="sr-only" htmlFor="sort">Sort</label>
            <select id="sort" name="sort" defaultValue={q.sort} className="field w-auto">
              <option value="closing">Closing date</option>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="size">Issue size</option>
            </select>
            <button className="btn btn-primary" type="submit">Apply</button>
          </form>
        </div>

        {q.tab === "upcoming" ? (
          <div className="card flex gap-3 border-l-4 px-4 py-3 text-sm" style={{ borderLeftColor: "var(--upcoming)" }}>
            <p>
              <strong>Upcoming</strong> shows issues NSE has already announced. Companies that have only filed a draft prospectus aren&apos;t
              listed until NSE publishes their dates.
            </p>
          </div>
        ) : null}

        {ipos.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ipos.map((i) => (
              <IpoCard key={i.id} ipo={i} />
            ))}
          </div>
        ) : (
          <div className="card px-6 py-14 text-center">
            <p className="text-lg font-semibold">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              {q.q || q.type !== "all"
                ? "No IPOs match your filters. Try clearing the search."
                : q.tab === "open"
                  ? "No IPOs are open right now, or the first sync hasn't run. Start the agents with `npm run agents`."
                  : "IPOs will show up here as the daily agents collect them."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

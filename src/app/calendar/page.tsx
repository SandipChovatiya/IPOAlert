import type { Metadata } from "next";
import Link from "next/link";
import { listAllForCalendar } from "@/lib/db";
import { todayIST } from "@/lib/status";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const KIND = {
  open: { label: "Opens", color: "var(--open)", bg: "var(--open-soft)" },
  close: { label: "Closes", color: "var(--danger)", bg: "var(--danger-soft)" },
  list: { label: "Lists", color: "var(--accent)", bg: "var(--accent-soft)" },
} as const;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayIST();
  const ym = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : today.slice(0, 7);
  const [y, mo] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const shift = (d: number) => {
    const n = new Date(Date.UTC(y, mo - 1 + d, 1));
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const ipos = await listAllForCalendar();
  const events = new Map<string, { kind: keyof typeof KIND; name: string; slug: string }[]>();
  const add = (date: string | null, kind: keyof typeof KIND, name: string, slug: string) => {
    if (!date || !date.startsWith(ym)) return;
    events.set(date, [...(events.get(date) ?? []), { kind, name, slug }]);
  };
  for (const i of ipos) {
    add(i.startDate, "open", i.name, i.slug);
    add(i.endDate, "close", i.name, i.slug);
    add(i.listingDate, "list", i.name, i.slug);
  }

  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, k) => k + 1)];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{MONTHS[mo - 1]} {y}</h1>
        <div className="flex gap-2">
          <Link className="btn" href={`/calendar?m=${shift(-1)}`} aria-label="Previous month">←</Link>
          <Link className="btn" href="/calendar">Today</Link>
          <Link className="btn" href={`/calendar?m=${shift(1)}`} aria-label="Next month">→</Link>
        </div>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs">
        {Object.values(KIND).map((k) => (
          <li key={k.label} className="chip" style={{ background: k.bg, color: k.color }}>{k.label}</li>
        ))}
      </ul>

      <div className="overflow-x-auto">
        <div className="card grid min-w-[44rem] grid-cols-7 overflow-hidden">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b border-border bg-surface-2 px-2 py-2 text-xs font-semibold text-muted">{d}</div>
          ))}
          {cells.map((d, idx) => {
            if (!d) return <div key={`b${idx}`} className="min-h-24 border-b border-r border-border bg-bg/40" />;
            const date = `${ym}-${String(d).padStart(2, "0")}`;
            const ev = events.get(date) ?? [];
            const isToday = date === today;
            return (
              <div key={date} className="min-h-24 space-y-1 border-b border-r border-border p-1.5">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${isToday ? "bg-accent font-bold text-accent-contrast" : "text-muted"}`}>{d}</span>
                {ev.slice(0, 3).map((e, i) => (
                  <Link
                    key={i}
                    href={`/ipo/${e.slug}`}
                    title={`${KIND[e.kind].label}: ${e.name}`}
                    className="block truncate rounded px-1.5 py-0.5 text-[0.7rem] font-medium"
                    style={{ background: KIND[e.kind].bg, color: KIND[e.kind].color }}
                  >
                    {e.name}
                  </Link>
                ))}
                {ev.length > 3 ? <p className="px-1 text-[0.7rem] text-muted">+{ev.length - 3} more</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

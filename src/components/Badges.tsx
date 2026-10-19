import { TYPE_LABEL } from "@/lib/format";

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: "Open now", bg: "var(--open-soft)", fg: "var(--open)" },
  upcoming: { label: "Upcoming", bg: "var(--upcoming-soft)", fg: "var(--upcoming)" },
  announced: { label: "Announced", bg: "var(--upcoming-soft)", fg: "var(--upcoming)" },
  closed: { label: "Closed", bg: "var(--closed-soft)", fg: "var(--closed)" },
  listed: { label: "Listed", bg: "var(--accent-soft)", fg: "var(--accent)" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.closed;
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      {status === "open" ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.fg }} /> : null}
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span className="chip border border-border text-muted">{TYPE_LABEL[type] ?? type}</span>
  );
}

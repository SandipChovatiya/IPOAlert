export type IpoStatus = "upcoming" | "open" | "closed" | "listed" | "announced";

/** Today's date in India (YYYY-MM-DD) — IPO dates are IST. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/**
 * Derive status from dates. Used by the status agent to move archived rows along
 * (open -> closed -> listed) when the API no longer returns them.
 */
export function computeStatus(
  i: { startDate?: string | null; endDate?: string | null; listingDate?: string | null; status?: string | null },
  today: string = todayIST(),
): IpoStatus {
  const { startDate, endDate, listingDate } = i;
  if (!startDate || !endDate) return (i.status as IpoStatus) || "announced";
  if (today < startDate) return "upcoming";
  if (today <= endDate) return "open";
  if (listingDate && today >= listingDate) return "listed";
  return "closed";
}

/** UI tab each status belongs to. */
export function tabFor(status: string): "open" | "upcoming" | "closed" {
  if (status === "open") return "open";
  if (status === "upcoming" || status === "announced") return "upcoming";
  return "closed"; // closed + listed
}

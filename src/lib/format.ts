import { daysBetween, todayIST } from "./status";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(d?: string | null): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function fmtShortDate(d?: string | null): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "—";
  const [, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[m - 1]}`;
}

export function inr(n?: number | null): string {
  if (n == null) return "—";
  return "₹" + new Intl.NumberFormat("en-IN").format(n);
}

/** "10-10" -> {min:10,max:10}; "₹95 - ₹100" -> {min:95,max:100} */
export function parsePriceBand(s?: string | null): { min: number; max: number } | null {
  if (!s) return null;
  const nums = s.match(/\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums?.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export function fmtPriceBand(s?: string | null): string {
  const b = parsePriceBand(s);
  if (!b) return s || "—";
  return b.min === b.max ? `₹${b.max}` : `₹${b.min} – ₹${b.max}`;
}

export function fmtIssueSize(s?: string | null): string {
  if (!s) return "—";
  const m = s.trim().match(/^([\d.,]+)\s*(cr|crore|l|lakh)?/i);
  if (!m) return s;
  return m[2] ? `₹${m[1]} ${/^c/i.test(m[2]) ? "Cr" : "Lakh"}` : s;
}

/** Human countdown relative to today (IST), tailored to the IPO's tab. */
export function timing(i: { status: string; startDate: string | null; endDate: string | null; listingDate: string | null }) {
  const today = todayIST();
  if (i.status === "open" && i.endDate) {
    const d = daysBetween(today, i.endDate);
    return { text: d === 0 ? "Closes today" : d === 1 ? "Closes tomorrow" : `Closes in ${d} days`, urgent: d <= 1, days: d };
  }
  if ((i.status === "upcoming" || i.status === "announced") && i.startDate) {
    const d = daysBetween(today, i.startDate);
    return { text: d <= 0 ? "Opens today" : d === 1 ? "Opens tomorrow" : `Opens in ${d} days`, urgent: false, days: d };
  }
  if (i.status === "listed" && i.listingDate) return { text: `Listed ${fmtShortDate(i.listingDate)}`, urgent: false, days: 0 };
  if (i.endDate) return { text: `Closed ${fmtShortDate(i.endDate)}`, urgent: false, days: 0 };
  return { text: "", urgent: false, days: 0 };
}

export const TYPE_LABEL: Record<string, string> = { EQ: "Mainboard", SME: "SME", DEBT: "Debt" };

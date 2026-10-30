import { z } from "zod";
import { apiIpoSchema, type ApiIpo } from "./schemas";
import { computeStatus, todayIST } from "./status";

/**
 * Free source: the public IPO listings that nseindia.com itself serves to its website
 * (current / upcoming / past issues). No key, no plan. Unofficial endpoints, so every field is
 * validated and a failure never corrupts stored data. Be polite: a handful of requests per sync.
 */
const ORIGIN = "https://www.nseindia.com";
const UA = "Mozilla/5.0 (compatible; IPOWatch/1.0; personal-use)";
const HISTORY_DAYS = Number(process.env.NSE_HISTORY_DAYS) || 180;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "09-Oct-2026" / "07-OCT-2026" -> "2026-10-09"; "-" or junk -> undefined */
export function parseNseDate(s?: string | null): string | undefined {
  const m = s?.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return undefined;
  const mm = MONTHS[m[2].toLowerCase()];
  return mm ? `${m[3]}-${mm}-${m[1].padStart(2, "0")}` : undefined;
}

/** "Rs.77 to Rs.82" -> "77-82"; "Rs.10" -> "10-10"; "-" -> undefined */
export function parseNsePrice(s?: string | null): { band: string; max: number } | undefined {
  const nums = s?.match(/\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums?.length) return undefined;
  const min = Math.min(...nums), max = Math.max(...nums);
  return { band: `${min}-${max}`, max };
}

function sizeString(shares?: number, maxPrice?: number): string | undefined {
  if (!shares || !maxPrice) return undefined;
  const v = shares * maxPrice;
  return v >= 1e7 ? `${(v / 1e7).toFixed(2)}cr` : `${(v / 1e5).toFixed(2)}l`;
}

function typeOf(series?: string | null): "EQ" | "SME" | "DEBT" {
  const s = (series ?? "").toUpperCase();
  return s === "SME" ? "SME" : s === "DEBT" ? "DEBT" : "EQ";
}

const slugOf = (symbol: string) => symbol.toLowerCase().replace(/[^a-z0-9._-]/g, "-");

const str = z.string().max(300).nullish();
const currentRow = z.object({
  companyName: str, symbol: z.string().min(1).max(64), series: str,
  issueStartDate: str, issueEndDate: str, issuePrice: str, issueSize: str,
  noOfTime: str, noOfSharesOffered: str, noOfsharesBid: str,
});
const pastRow = z.object({
  company: str, companyName: str, symbol: z.string().min(1).max(64), securityType: str,
  ipoStartDate: str, ipoEndDate: str, listingDate: str, priceRange: str, issuePrice: str,
});

const num = (s?: string | null) => {
  const n = Number(String(s ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && String(s ?? "").trim() !== "" ? n : undefined;
};

function finish(raw: Record<string, unknown>): ApiIpo | null {
  const withStatus = { ...raw } as Record<string, unknown>;
  const r = apiIpoSchema.safeParse(withStatus);
  if (!r.success) return null;
  return { ...r.data, status: computeStatus(r.data), source: "nse" };
}

/* ---------- HTTP with the cookie handshake NSE's website uses ---------- */

let cookie = "";
async function session(): Promise<void> {
  const r = await fetch(`${ORIGIN}/market-data/all-upcoming-issues-ipo`, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(path: string, retried = false): Promise<unknown> {
  if (!cookie) await session();
  const r = await fetch(ORIGIN + path, {
    headers: { "user-agent": UA, accept: "application/json", referer: `${ORIGIN}/`, cookie },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if ((r.status === 401 || r.status === 403) && !retried) {
    cookie = "";
    await sleep(2000);
    return getJson(path, true);
  }
  if (!r.ok) throw new Error(`NSE responded ${r.status} for ${path.split("?")[0]}`);
  return r.json();
}

const rows = (j: unknown): unknown[] => (Array.isArray(j) ? j : []);

/** Current + upcoming + recent past issues from NSE, mapped to our IPO shape. */
export async function fetchNseIpos(): Promise<{ ipos: ApiIpo[]; skipped: number }> {
  const out = new Map<string, ApiIpo>();
  let skipped = 0;
  const today = todayIST();
  const cutoff = new Date(Date.parse(today) - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);

  const feeds: [string, "now" | "past"][] = [
    ["/api/ipo-current-issue", "now"],
    ["/api/all-upcoming-issues?category=ipo", "now"],
    ["/api/public-past-issues", "past"],
  ];

  for (const [i, [path, kind]] of feeds.entries()) {
    if (i) await sleep(2500);
    const list = rows(await getJson(path));
    for (const raw of list) {
      if (kind === "now") {
        const p = currentRow.safeParse(raw);
        if (!p.success) { skipped++; continue; }
        const c = p.data;
        const price = parseNsePrice(c.issuePrice);
        const shares = num(c.noOfSharesOffered) ?? num(c.issueSize);
        const ipo = finish({
          id: `nse-${c.symbol}`, slug: slugOf(c.symbol), name: c.companyName || c.symbol, symbol: c.symbol,
          type: typeOf(c.series),
          startDate: parseNseDate(c.issueStartDate), endDate: parseNseDate(c.issueEndDate),
          priceRange: price?.band, issueSize: sizeString(num(c.issueSize), price?.max),
          subscription: c.noOfTime != null
            ? { timesSubscribed: num(c.noOfTime), noOfSharesOffered: shares, noOfsharesBid: num(c.noOfsharesBid), updatedAt: new Date().toISOString() }
            : undefined,
        });
        // First feed wins: "current" carries the subscription numbers the "upcoming" feed lacks.
        if (ipo && !out.has(ipo.slug)) out.set(ipo.slug, ipo);
        else if (!ipo) skipped++;
      } else {
        const p = pastRow.safeParse(raw);
        if (!p.success) { skipped++; continue; }
        const c = p.data;
        const end = parseNseDate(c.ipoEndDate);
        if (!end || end < cutoff) continue; // keep the archive to the last N days
        const price = parsePrice(c);
        const ipo = finish({
          id: `nse-${c.symbol}`, slug: slugOf(c.symbol), name: c.company || c.companyName || c.symbol, symbol: c.symbol,
          type: typeOf(c.securityType),
          startDate: parseNseDate(c.ipoStartDate), endDate: end, listingDate: parseNseDate(c.listingDate),
          priceRange: price?.band,
        });
        // Don't let an older "past" row overwrite a fresher "current" row for the same symbol.
        if (ipo && !out.has(ipo.slug)) out.set(ipo.slug, ipo);
        else if (!ipo) skipped++;
      }
    }
  }
  return { ipos: [...out.values()], skipped };
}

const quoteSchema = z.object({ priceInfo: z.object({ lastPrice: z.number().positive().finite() }) });

/** Last traded price for a listed symbol, or null when NSE has no quote for it. */
export async function fetchNseQuote(symbol: string): Promise<number | null> {
  try {
    const p = quoteSchema.safeParse(await getJson(`/api/quote-equity?symbol=${encodeURIComponent(symbol)}`));
    return p.success ? p.data.priceInfo.lastPrice : null;
  } catch (e) {
    if (e instanceof Error && /NSE responded 404/.test(e.message)) return null;
    throw e;
  }
}

function parsePrice(c: z.infer<typeof pastRow>) {
  return parseNsePrice(c.priceRange) ?? parseNsePrice(c.issuePrice);
}

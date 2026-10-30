import { createClient, type Client, type InValue } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";
import type { ApiIpo } from "./schemas";
import { computeStatus, tabFor } from "./status";

const globalForDb = globalThis as unknown as { __ipoDb?: Client; __ipoDbReady?: Promise<void> };

function getClient(): Client {
  if (!globalForDb.__ipoDb) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "ipo.db").replace(/\\/g, "/");
    globalForDb.__ipoDb = createClient({ url: `file:${file}` });
  }
  return globalForDb.__ipoDb;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ipos (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT,
    status TEXT NOT NULL DEFAULT 'announced',
    start_date TEXT,
    end_date TEXT,
    listing_date TEXT,
    price_range TEXT,
    listing_gain TEXT,
    min_qty INTEGER,
    min_amount INTEGER,
    issue_size TEXT,
    logo TEXT,
    prospectus_url TEXT,
    nse_info_url TEXT,
    info_url TEXT,
    about TEXT,
    strengths TEXT,
    risks TEXT,
    media_links TEXT,
    schedule TEXT,
    subscription TEXT,
    gmp TEXT,
    source TEXT,
    first_seen_at TEXT NOT NULL,
    last_synced_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ipos_status ON ipos(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ipos_end ON ipos(end_date)`,
  `CREATE TABLE IF NOT EXISTS subscription_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ipo_id TEXT NOT NULL,
    times_subscribed REAL,
    shares_offered REAL,
    shares_bid REAL,
    captured_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_snap_ipo ON subscription_snapshots(ipo_id, captured_at)`,
  `CREATE TABLE IF NOT EXISTS ai_summaries (
    ipo_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    items INTEGER DEFAULT 0,
    message TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS api_usage (
    day TEXT NOT NULL,
    provider TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, provider)
  )`,
];

/** Columns added after the first release of the table. */
const ADDED_COLUMNS: [string, string][] = [
  ["cmp", "REAL"],
  ["cmp_updated_at", "TEXT"],
];

/** Returns the shared client after making sure the schema exists. */
export async function db(): Promise<Client> {
  const c = getClient();
  if (!globalForDb.__ipoDbReady) {
    globalForDb.__ipoDbReady = (async () => {
      await c.execute("PRAGMA journal_mode = WAL");
      await c.execute("PRAGMA busy_timeout = 5000");
      for (const sql of SCHEMA) await c.execute(sql);
      // CREATE TABLE IF NOT EXISTS won't add columns to an existing table, so add them one by one.
      const cols = new Set((await c.execute("PRAGMA table_info(ipos)")).rows.map((r) => String(r.name)));
      for (const [name, type] of ADDED_COLUMNS) {
        if (!cols.has(name)) await c.execute(`ALTER TABLE ipos ADD COLUMN ${name} ${type}`);
      }
    })();
  }
  await globalForDb.__ipoDbReady;
  return c;
}

/* ---------- Domain type & row mapping ---------- */

export interface Ipo {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  type: string | null;
  status: string;
  tab: "open" | "upcoming" | "closed";
  startDate: string | null;
  endDate: string | null;
  listingDate: string | null;
  priceRange: string | null;
  listingGain: string | null;
  cmp: number | null;
  cmpUpdatedAt: string | null;
  minQty: number | null;
  minAmount: number | null;
  issueSize: string | null;
  logo: string | null;
  prospectusUrl: string | null;
  nseInfoUrl: string | null;
  infoUrl: string | null;
  about: string | null;
  strengths: string[];
  risks: string[];
  mediaLinks: string[];
  schedule: { date?: string | null; event?: string | null }[];
  subscription: { timesSubscribed?: number; noOfSharesOffered?: number; noOfsharesBid?: number; updatedAt?: string | null } | null;
  gmp: Record<string, unknown> | null;
  aiSummary: string | null;
  lastSyncedAt: string;
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToIpo(r: Record<string, any>): Ipo {
  const status = String(r.status);
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    symbol: r.symbol,
    type: r.type ?? null,
    status,
    tab: tabFor(status),
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    listingDate: r.listing_date ?? null,
    priceRange: r.price_range ?? null,
    listingGain: r.listing_gain ?? null,
    cmp: r.cmp == null ? null : Number(r.cmp),
    cmpUpdatedAt: r.cmp_updated_at ?? null,
    minQty: r.min_qty == null ? null : Number(r.min_qty),
    minAmount: r.min_amount == null ? null : Number(r.min_amount),
    issueSize: r.issue_size ?? null,
    logo: r.logo ?? null,
    prospectusUrl: r.prospectus_url ?? null,
    nseInfoUrl: r.nse_info_url ?? null,
    infoUrl: r.info_url ?? null,
    about: r.about ?? null,
    strengths: parseJson(r.strengths, []),
    risks: parseJson(r.risks, []),
    mediaLinks: parseJson(r.media_links, []),
    schedule: parseJson(r.schedule, []),
    subscription: parseJson(r.subscription, null),
    gmp: parseJson(r.gmp, null),
    aiSummary: r.ai_summary ?? null,
    lastSyncedAt: r.last_synced_at,
  };
}

/* ---------- Writes (used by agents) ---------- */

/** Insert or update one IPO from validated API data. Returns true if it was new. */
export async function upsertIpo(ipo: ApiIpo, now = new Date().toISOString()): Promise<boolean> {
  const c = await db();
  // Same IPO may already exist from another source (e.g. NSE) under a different id: reuse that row.
  const bySlug = await c.execute({ sql: "SELECT id FROM ipos WHERE slug = ?", args: [ipo.slug] });
  if (bySlug.rows[0] && String(bySlug.rows[0].id) !== ipo.id) ipo = { ...ipo, id: String(bySlug.rows[0].id) };
  const existing = await c.execute({ sql: "SELECT id FROM ipos WHERE id = ?", args: [ipo.id] });
  const isNew = existing.rows.length === 0;
  const j = (v: unknown) => (v == null ? null : JSON.stringify(v));
  const status = ipo.status || computeStatus(ipo);
  const args: InValue[] = [
    ipo.id, ipo.slug, ipo.name, ipo.symbol, ipo.type ?? null, status,
    ipo.startDate ?? null, ipo.endDate ?? null, ipo.listingDate ?? null,
    ipo.priceRange ?? null, ipo.listingGain == null ? null : String(ipo.listingGain),
    ipo.minQty ?? null, ipo.minAmount ?? null, ipo.issueSize ?? null,
    ipo.logo ?? null, ipo.prospectusUrl ?? null, ipo.nseInfoUrl ?? null, ipo.infoUrl ?? null,
    ipo.about ?? null, j(ipo.strengths), j(ipo.risks), j(ipo.mediaCoverageLinks),
    j(ipo.schedule), j(ipo.subscription), j(ipo.gmp), ipo.source ?? null, now, now,
  ];
  await c.execute({
    sql: `INSERT INTO ipos (id, slug, name, symbol, type, status, start_date, end_date, listing_date,
            price_range, listing_gain, min_qty, min_amount, issue_size, logo, prospectus_url,
            nse_info_url, info_url, about, strengths, risks, media_links, schedule, subscription,
            gmp, source, first_seen_at, last_synced_at)
          VALUES (${args.map(() => "?").join(",")})
          ON CONFLICT(id) DO UPDATE SET
            slug=excluded.slug, name=excluded.name, symbol=excluded.symbol, type=excluded.type,
            status=excluded.status, start_date=excluded.start_date, end_date=excluded.end_date,
            listing_date=excluded.listing_date, price_range=excluded.price_range,
            listing_gain=excluded.listing_gain, min_qty=excluded.min_qty, min_amount=excluded.min_amount,
            issue_size=excluded.issue_size, logo=excluded.logo, prospectus_url=excluded.prospectus_url,
            nse_info_url=excluded.nse_info_url, info_url=excluded.info_url, about=excluded.about,
            strengths=excluded.strengths, risks=excluded.risks, media_links=excluded.media_links,
            schedule=excluded.schedule, subscription=excluded.subscription,
            gmp=COALESCE(excluded.gmp, ipos.gmp), source=excluded.source,
            last_synced_at=excluded.last_synced_at`,
    args,
  });
  const s = ipo.subscription;
  if (s && s.timesSubscribed != null) {
    await c.execute({
      sql: `INSERT INTO subscription_snapshots (ipo_id, times_subscribed, shares_offered, shares_bid, captured_at)
            VALUES (?,?,?,?,?)`,
      args: [ipo.id, s.timesSubscribed ?? null, s.noOfSharesOffered ?? null, s.noOfsharesBid ?? null, now],
    });
  }
  return isNew;
}

/**
 * Upsert from the NSE feed. NSE only knows dates, price band, size and subscription, so on an
 * existing row it refreshes just those fields and keeps richer data (about, risks, logo...) from
 * other sources. Returns true if the IPO was new.
 */
export async function upsertNseIpo(ipo: ApiIpo, now = new Date().toISOString()): Promise<boolean> {
  const c = await db();
  const found = await c.execute({ sql: "SELECT id FROM ipos WHERE slug = ?", args: [ipo.slug] });
  if (!found.rows[0]) return upsertIpo(ipo, now);
  const id = String(found.rows[0].id);
  await c.execute({
    sql: `UPDATE ipos SET
            type = COALESCE(?, type), status = ?,
            start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
            listing_date = COALESCE(?, listing_date), price_range = COALESCE(?, price_range),
            issue_size = COALESCE(?, issue_size), subscription = COALESCE(?, subscription),
            last_synced_at = ?
          WHERE id = ?`,
    args: [
      ipo.type ?? null, ipo.status || computeStatus(ipo),
      ipo.startDate ?? null, ipo.endDate ?? null, ipo.listingDate ?? null, ipo.priceRange ?? null,
      ipo.issueSize ?? null, ipo.subscription ? JSON.stringify(ipo.subscription) : null, now, id,
    ],
  });
  const s = ipo.subscription;
  if (s && s.timesSubscribed != null) {
    await c.execute({
      sql: `INSERT INTO subscription_snapshots (ipo_id, times_subscribed, shares_offered, shares_bid, captured_at)
            VALUES (?,?,?,?,?)`,
      args: [id, s.timesSubscribed ?? null, s.noOfSharesOffered ?? null, s.noOfsharesBid ?? null, now],
    });
  }
  return false;
}

/** Listed equity IPOs (not debt) that are recent enough to be worth quoting. */
export async function listedIposForQuote(): Promise<{ id: string; symbol: string }[]> {
  const c = await db();
  const days = Number(process.env.LISTED_QUOTE_DAYS) || 365;
  const r = await c.execute({
    sql: `SELECT id, symbol FROM ipos
          WHERE status = 'listed' AND COALESCE(type, 'EQ') != 'DEBT'
            AND (listing_date IS NULL OR listing_date >= date('now', ?))`,
    args: [`-${days} days`],
  });
  return r.rows.map((x) => ({ id: String(x.id), symbol: String(x.symbol) }));
}

export async function updateCmp(id: string, price: number, now = new Date().toISOString()) {
  const c = await db();
  await c.execute({ sql: "UPDATE ipos SET cmp = ?, cmp_updated_at = ? WHERE id = ?", args: [price, now, id] });
}

export async function logRun(agent: string, fn: () => Promise<{ items: number; message?: string }>) {
  const c = await db();
  const started = new Date().toISOString();
  const res = await c.execute({
    sql: "INSERT INTO agent_runs (agent, started_at, status) VALUES (?, ?, 'running')",
    args: [agent, started],
  });
  const id = Number(res.lastInsertRowid);
  try {
    const out = await fn();
    await c.execute({
      sql: "UPDATE agent_runs SET finished_at=?, status='ok', items=?, message=? WHERE id=?",
      args: [new Date().toISOString(), out.items, out.message ?? null, id],
    });
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await c.execute({
      sql: "UPDATE agent_runs SET finished_at=?, status='error', message=? WHERE id=?",
      args: [new Date().toISOString(), msg.slice(0, 500), id],
    });
    throw e;
  }
}

/* ---------- Reads (used by the web app) ---------- */

const SELECT = `SELECT i.*, a.summary AS ai_summary FROM ipos i LEFT JOIN ai_summaries a ON a.ipo_id = i.id`;

export async function listIpos(opts: {
  tab: "open" | "upcoming" | "closed";
  q?: string;
  type?: string;
  sort?: "closing" | "newest" | "name" | "size";
}): Promise<Ipo[]> {
  const c = await db();
  const statuses = opts.tab === "open" ? ["open"] : opts.tab === "upcoming" ? ["upcoming", "announced"] : ["closed", "listed"];
  const where: string[] = [`i.status IN (${statuses.map(() => "?").join(",")})`];
  const args: InValue[] = [...statuses];
  if (opts.q) {
    where.push("(i.name LIKE ? ESCAPE '\\' OR i.symbol LIKE ? ESCAPE '\\')");
    const like = `%${opts.q.replace(/[\\%_]/g, "\\$&")}%`;
    args.push(like, like);
  }
  if (opts.type && opts.type !== "all") {
    where.push("i.type = ?");
    args.push(opts.type);
  }
  const order =
    opts.sort === "name" ? "i.name COLLATE NOCASE ASC"
    : opts.sort === "newest" ? "i.start_date DESC"
    : opts.sort === "size" ? "CAST(i.issue_size AS REAL) DESC"
    : opts.tab === "closed" ? "i.end_date DESC" : "i.end_date ASC";
  const r = await c.execute({ sql: `${SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 300`, args });
  return r.rows.map((x) => rowToIpo(x as never));
}

export async function getIpoBySlug(slug: string): Promise<Ipo | null> {
  const c = await db();
  const r = await c.execute({ sql: `${SELECT} WHERE i.slug = ?`, args: [slug] });
  return r.rows[0] ? rowToIpo(r.rows[0] as never) : null;
}

export async function getIposBySlugs(slugs: string[]): Promise<Ipo[]> {
  if (!slugs.length) return [];
  const c = await db();
  const r = await c.execute({
    sql: `${SELECT} WHERE i.slug IN (${slugs.map(() => "?").join(",")})`,
    args: slugs,
  });
  return r.rows.map((x) => rowToIpo(x as never));
}

export async function listAllForCalendar(): Promise<Ipo[]> {
  const c = await db();
  const r = await c.execute(`${SELECT} ORDER BY i.start_date ASC LIMIT 500`);
  return r.rows.map((x) => rowToIpo(x as never));
}

export async function tabCounts(): Promise<Record<"open" | "upcoming" | "closed", number>> {
  const c = await db();
  const r = await c.execute("SELECT status, COUNT(*) AS n FROM ipos GROUP BY status");
  const out = { open: 0, upcoming: 0, closed: 0 };
  for (const row of r.rows) out[tabFor(String(row.status))] += Number(row.n);
  return out;
}

export async function subscriptionHistory(ipoId: string) {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT times_subscribed AS t, captured_at AS at FROM subscription_snapshots
          WHERE ipo_id = ? ORDER BY captured_at ASC LIMIT 200`,
    args: [ipoId],
  });
  return r.rows.map((x) => ({ t: Number(x.t), at: String(x.at) }));
}

export async function lastSync(): Promise<{ at: string; status: string } | null> {
  const c = await db();
  const r = await c.execute(
    "SELECT finished_at AS at, status FROM agent_runs WHERE agent='sync' AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1",
  );
  return r.rows[0] ? { at: String(r.rows[0].at), status: String(r.rows[0].status) } : null;
}

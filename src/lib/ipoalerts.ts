import { db } from "./db";
import { apiIpoSchema, apiListSchema, type ApiIpo } from "./schemas";
import { todayIST } from "./status";

const BASE = "https://api.ipoalerts.in";

export type Plan = "free" | "pro";

/** What each plan can do (from ipoalerts pricing). Free: open only, 1 IPO/request, 25 req/day, 6 req/min. */
export const PLANS = {
  free: { statuses: ["open"], pageSize: undefined as number | undefined, minGapMs: 10_500, dailyBudget: 22 },
  pro: { statuses: ["open", "upcoming", "announced", "closed", "listed"], pageSize: 3, minGapMs: 1_100, dailyBudget: 300 },
} as const;

export function currentPlan(): Plan {
  return process.env.IPOALERTS_PLAN === "pro" ? "pro" : "free";
}

export class QuotaError extends Error {}

let lastCall = 0;

async function usedToday(): Promise<number> {
  const c = await db();
  const r = await c.execute({
    sql: "SELECT count FROM api_usage WHERE day = ? AND provider = 'ipoalerts'",
    args: [todayIST()],
  });
  return r.rows[0] ? Number(r.rows[0].count) : 0;
}

async function recordCall() {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO api_usage (day, provider, count) VALUES (?, 'ipoalerts', 1)
          ON CONFLICT(day, provider) DO UPDATE SET count = count + 1`,
    args: [todayIST()],
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One rate-limited, quota-guarded GET. The API key never leaves this function. */
async function apiGet(pathAndQuery: string, attempt = 0): Promise<unknown> {
  const key = process.env.IPOALERTS_API_KEY?.trim();
  if (!key) throw new Error("IPOALERTS_API_KEY is not set (add it to .env.local)");
  const plan = PLANS[currentPlan()];

  const budget = Number(process.env.IPOALERTS_DAILY_BUDGET) || plan.dailyBudget;
  if ((await usedToday()) >= budget) throw new QuotaError(`Daily API budget of ${budget} requests reached`);

  const wait = lastCall + plan.minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  await recordCall();

  const res = await fetch(BASE + pathAndQuery, {
    headers: { "x-api-key": key, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 3) throw new Error(`ipoalerts responded ${res.status}`);
    const reset = Number(res.headers.get("x-ratelimit-reset")) || 60;
    await sleep(res.status === 429 ? reset * 1000 + 500 : 2000 * (attempt + 1));
    return apiGet(pathAndQuery, attempt + 1);
  }
  if (!res.ok) {
    let detail = "";
    try { detail = ((await res.json()) as { detail?: string }).detail ?? ""; } catch {}
    throw new Error(`ipoalerts responded ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

/** Fetch every IPO for one status, following pagination. Invalid items are skipped, not fatal. */
export async function fetchIposByStatus(status: string): Promise<{ ipos: ApiIpo[]; skipped: number }> {
  const plan = PLANS[currentPlan()];
  const out: ApiIpo[] = [];
  let skipped = 0;
  let page = 1;
  for (;;) {
    const qs = new URLSearchParams({ status, page: String(page) });
    if (plan.pageSize) qs.set("limit", String(plan.pageSize));
    const body = apiListSchema.parse(await apiGet(`/ipos?${qs}`));
    for (const raw of body.ipos) {
      const p = apiIpoSchema.safeParse(raw);
      if (p.success) out.push(p.data);
      else skipped++;
    }
    if (page >= body.meta.totalPages) break;
    page++;
  }
  return { ipos: out, skipped };
}

export async function usageToday() {
  return { used: await usedToday(), plan: currentPlan() };
}

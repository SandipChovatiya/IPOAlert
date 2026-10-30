import cron from "node-cron";
import { runSync } from "./sync";
import { runStatus } from "./status";
import { runSummarize } from "./summarize";
import { runQuotes } from "./quotes";
import { lastSync } from "../src/lib/db";

const tz = "Asia/Kolkata";
let busy = false;
const errMsg = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) });

/** Run agents one after another (never in parallel) so API pacing and the daily budget stay predictable. */
async function pipeline(label: string) {
  if (busy) return console.log(`[${label}] previous run still going, skipping`);
  busy = true;
  try {
    console.log(`[${label}] sync`, await runSync().catch(errMsg));
    console.log(`[${label}] status`, await runStatus().catch(errMsg));
    console.log(`[${label}] quotes`, await runQuotes().catch(errMsg));
    console.log(`[${label}] summarize`, await runSummarize().catch(errMsg));
  } finally {
    busy = false;
  }
}

// Morning, midday and evening (IST). The daily request budget stops the sync early if needed.
cron.schedule("0 9 * * *", () => void pipeline("09:00"), { timezone: tz });
cron.schedule("0 13 * * *", () => void pipeline("13:00"), { timezone: tz });
cron.schedule("30 17 * * *", () => void pipeline("17:30"), { timezone: tz });
// Date-based status roll-over shortly after midnight.
cron.schedule("10 0 * * *", () => void runStatus().then((r) => console.log("[00:10] status", r)), { timezone: tz });

// Closing prices after the NSE session (15:30 IST), weekdays only.
cron.schedule("45 15 * * 1-5", () => void runQuotes().then((r) => console.log("[15:45] quotes", r)), { timezone: tz });

console.log("IPO agents scheduled (IST): 09:00, 13:00, 17:30 pipeline; 15:45 weekday quotes; 00:10 status roll-over");

// Catch up on start if the last successful sync is older than 12h.
void lastSync().then((s) => {
  const stale = !s || s.status !== "ok" || Date.now() - Date.parse(s.at) > 12 * 3600_000;
  if (stale) void pipeline("startup");
});

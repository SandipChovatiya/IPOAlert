import { listedIposForQuote, logRun, updateCmp } from "../src/lib/db";
import { fetchNseQuote } from "../src/lib/nse";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Quotes agent: once an IPO is listed, keep its current market price fresh from NSE.
 * A failed or missing quote leaves the stored price untouched.
 */
export async function runQuotes() {
  return logRun("quotes", async () => {
    const targets = await listedIposForQuote();
    let updated = 0, failed = 0;
    for (const [i, t] of targets.entries()) {
      if (i) await sleep(1500);
      try {
        const price = await fetchNseQuote(t.symbol);
        if (price != null) { await updateCmp(t.id, price); updated++; }
      } catch {
        failed++;
      }
    }
    return { items: updated, message: `${updated}/${targets.length} quoted${failed ? `, ${failed} failed` : ""}` };
  });
}

import { PLANS, currentPlan, fetchIposByStatus, QuotaError } from "../src/lib/ipoalerts";
import { fetchNseIpos } from "../src/lib/nse";
import { logRun, upsertIpo, upsertNseIpo } from "../src/lib/db";

/**
 * Sync agent.
 *  1. Primary, free: NSE public listings -> current, upcoming and recent past IPOs.
 *  2. Optional enrichment: if IPOALERTS_API_KEY is set, ipoalerts adds company description,
 *     strengths, risks, logo, lot size (free plan = open IPOs only, within its daily budget).
 * Either source failing never wipes stored data; the run only errors if nothing could be fetched.
 */
export async function runSync() {
  return logRun("sync", async () => {
    let items = 0;
    let added = 0;
    const notes: string[] = [];
    let nseOk = false;

    if (process.env.IPO_PROVIDER !== "ipoalerts") {
      try {
        const { ipos, skipped } = await fetchNseIpos();
        for (const ipo of ipos) {
          if (await upsertNseIpo(ipo)) added++;
          items++;
        }
        nseOk = true;
        notes.push(`NSE: ${ipos.length} IPOs`);
        if (skipped) notes.push(`${skipped} NSE row(s) skipped`);
      } catch (e) {
        notes.push(`NSE failed: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    if (process.env.IPOALERTS_API_KEY?.trim() && process.env.IPOALERTS_ENRICH !== "off") {
      const plan = PLANS[currentPlan()];
      for (const status of plan.statuses) {
        try {
          const { ipos, skipped } = await fetchIposByStatus(status);
          for (const ipo of ipos) {
            if (await upsertIpo(ipo)) added++;
            items++;
          }
          if (skipped) notes.push(`${skipped} invalid ${status} item(s) skipped`);
        } catch (e) {
          notes.push(`ipoalerts ${status}: ${e instanceof QuotaError ? e.message : e instanceof Error ? e.message : "failed"}`);
          if (e instanceof QuotaError) break;
        }
      }
    }

    if (items === 0 && !nseOk) throw new Error(notes.join("; ") || "No data source available");
    return { items, message: [`${added} new`, ...notes].join("; ") };
  });
}

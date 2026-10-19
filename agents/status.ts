import { db, logRun } from "../src/lib/db";
import { computeStatus, todayIST } from "../src/lib/status";

/**
 * Status agent: the free API only lists *open* IPOs, so once an IPO disappears from that list
 * we keep it in the archive and advance its status by date (open -> closed -> listed).
 * Also prunes old subscription snapshots and run logs.
 */
export async function runStatus() {
  return logRun("status", async () => {
    const c = await db();
    const today = todayIST();
    const rows = await c.execute("SELECT id, status, start_date, end_date, listing_date FROM ipos");
    let changed = 0;
    for (const r of rows.rows) {
      const next = computeStatus(
        {
          status: String(r.status),
          startDate: r.start_date as string | null,
          endDate: r.end_date as string | null,
          listingDate: r.listing_date as string | null,
        },
        today,
      );
      if (next !== r.status) {
        await c.execute({ sql: "UPDATE ipos SET status = ? WHERE id = ?", args: [next, r.id as string] });
        changed++;
      }
    }
    await c.execute("DELETE FROM subscription_snapshots WHERE captured_at < datetime('now', '-120 days')");
    await c.execute("DELETE FROM agent_runs WHERE started_at < datetime('now', '-60 days')");
    return { items: changed, message: `${changed} status change(s)` };
  });
}

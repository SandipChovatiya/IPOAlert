import { runSync } from "./sync";
import { runStatus } from "./status";
import { runSummarize } from "./summarize";

const which = process.argv[2];
const table = { sync: runSync, status: runStatus, summarize: runSummarize } as const;
const errMsg = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) });

async function main() {
  if (which === "all") {
    for (const fn of [runSync, runStatus, runSummarize]) console.log(await fn().catch(errMsg));
    return;
  }
  const fn = table[which as keyof typeof table];
  if (!fn) {
    console.error("Usage: tsx agents/run.ts <sync|status|summarize|all>");
    process.exit(2);
  }
  console.log(which, await fn());
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(errMsg(e).error);
    process.exit(1);
  },
);

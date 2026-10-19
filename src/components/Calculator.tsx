"use client";

import { useState } from "react";
import { inr } from "@/lib/format";

/** How much money for N lots at the top of the price band. */
export default function Calculator({ minQty, priceMax }: { minQty: number; priceMax: number }) {
  const [lots, setLots] = useState(1);
  const safe = Math.min(Math.max(1, Math.floor(lots) || 1), 1000);
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="lots">Number of lots</label>
      <input
        id="lots"
        type="number"
        min={1}
        max={1000}
        value={lots}
        onChange={(e) => setLots(Number(e.target.value))}
        className="field max-w-40"
      />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Shares</dt>
          <dd className="font-semibold">{(safe * minQty).toLocaleString("en-IN")}</dd>
        </div>
        <div>
          <dt className="text-muted">Amount (at upper band)</dt>
          <dd className="text-lg font-bold">{inr(safe * minQty * priceMax)}</dd>
        </div>
      </dl>
    </div>
  );
}

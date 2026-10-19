import { describe, expect, it } from "vitest";
import { computeStatus, daysBetween, tabFor } from "../src/lib/status";
import { apiIpoSchema, listQuerySchema, slugListSchema } from "../src/lib/schemas";
import { fmtPriceBand, parsePriceBand } from "../src/lib/format";

describe("status", () => {
  const ipo = { startDate: "2026-10-05", endDate: "2026-10-08", listingDate: "2026-10-13" };
  it("moves through the lifecycle by date", () => {
    expect(computeStatus(ipo, "2026-10-04")).toBe("upcoming");
    expect(computeStatus(ipo, "2026-10-05")).toBe("open");
    expect(computeStatus(ipo, "2026-10-08")).toBe("open");
    expect(computeStatus(ipo, "2026-10-09")).toBe("closed");
    expect(computeStatus(ipo, "2026-10-13")).toBe("listed");
  });
  it("keeps API status when dates are missing", () => {
    expect(computeStatus({ status: "announced" }, "2026-10-08")).toBe("announced");
  });
  it("maps statuses to tabs", () => {
    expect(tabFor("announced")).toBe("upcoming");
    expect(tabFor("listed")).toBe("closed");
  });
  it("counts days", () => expect(daysBetween("2026-10-08", "2026-10-10")).toBe(2));
});

describe("schemas", () => {
  const base = { id: "1", name: "Acme", symbol: "ACME", slug: "acme" };
  it("accepts a minimal IPO and strips unknown fields", () => {
    const r = apiIpoSchema.parse({ ...base, evil: "x", minQty: "1,000" });
    expect(r.minQty).toBe(1000);
    expect("evil" in r).toBe(false);
  });
  it("drops non-http(s) URLs", () => {
    const r = apiIpoSchema.parse({ ...base, logo: "javascript:alert(1)", infoUrl: "https://ok.example/x" });
    expect(r.logo).toBeUndefined();
    expect(r.infoUrl).toBe("https://ok.example/x");
  });
  it("rejects unsafe slugs", () => {
    expect(apiIpoSchema.safeParse({ ...base, slug: "../etc" }).success).toBe(false);
  });
  it("falls back to safe query defaults", () => {
    const q = listQuerySchema.parse({ tab: "x'; DROP TABLE ipos;--", type: "zzz", q: "a".repeat(500) });
    expect(q.tab).toBe("open");
    expect(q.type).toBe("all");
    expect(q.q).toBe("");
  });
  it("validates slug lists", () => {
    expect(slugListSchema.safeParse("a,b-c").success).toBe(true);
    expect(slugListSchema.safeParse("a,../b").success).toBe(false);
  });
});

describe("format", () => {
  it("parses price bands", () => {
    expect(parsePriceBand("95-100")).toEqual({ min: 95, max: 100 });
    expect(fmtPriceBand("10-10")).toBe("₹10");
  });
});

import { parseNseDate, parseNsePrice } from "../src/lib/nse";
describe("nse parsing", () => {
  it("parses dates", () => {
    expect(parseNseDate("09-Oct-2026")).toBe("2026-10-09");
    expect(parseNseDate("07-OCT-2026")).toBe("2026-10-07");
    expect(parseNseDate("-")).toBeUndefined();
    expect(parseNseDate(undefined)).toBeUndefined();
  });
  it("parses prices", () => {
    expect(parseNsePrice("Rs.77 to Rs.82")).toEqual({ band: "77-82", max: 82 });
    expect(parseNsePrice("Rs.10")).toEqual({ band: "10-10", max: 10 });
    expect(parseNsePrice("-")).toBeUndefined();
  });
});

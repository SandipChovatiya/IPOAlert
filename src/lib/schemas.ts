import { z } from "zod";

/** Only http(s) URLs are ever rendered as links/images (blocks javascript:, data: etc). */
const safeUrl = z
  .string()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), "must be http(s)");

const num = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/)
  .transform((s) => s.slice(0, 10));

const text = (max: number) => z.string().max(max);

export const subscriptionSchema = z
  .object({
    noOfSharesOffered: num,
    noOfsharesBid: num,
    timesSubscribed: num,
    updatedAt: z.string().max(64).nullish(),
  })
  .partial();

export const gmpSchema = z.record(z.string(), z.unknown());

/** One IPO as returned by api.ipoalerts.in. Unknown fields are stripped. */
export const apiIpoSchema = z.object({
  id: text(64),
  name: text(300),
  symbol: text(64),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-_.]{0,127}$/i),
  source: text(32).nullish(),
  type: text(16).nullish(),
  status: text(16).nullish(),
  startDate: dateStr.nullish(),
  endDate: dateStr.nullish(),
  listingDate: dateStr.nullish(),
  priceRange: text(64).nullish(),
  listingGain: z.union([z.string().max(32), z.number()]).nullish(),
  minQty: num,
  minAmount: num,
  issueSize: text(64).nullish(),
  logo: safeUrl.nullish().catch(undefined),
  prospectusUrl: safeUrl.nullish().catch(undefined),
  nseInfoUrl: safeUrl.nullish().catch(undefined),
  infoUrl: safeUrl.nullish().catch(undefined),
  about: text(20000).nullish(),
  schedule: z
    .array(z.object({ date: text(32).nullish(), event: text(300).nullish() }))
    .nullish()
    .catch(undefined),
  strengths: z.array(text(2000)).max(50).nullish().catch(undefined),
  risks: z.array(text(2000)).max(50).nullish().catch(undefined),
  mediaCoverageLinks: z.array(safeUrl).max(50).nullish().catch(undefined),
  subscription: subscriptionSchema.nullish().catch(undefined),
  gmp: gmpSchema.nullish().catch(undefined),
});
export type ApiIpo = z.infer<typeof apiIpoSchema>;

export const apiListSchema = z.object({
  meta: z.object({
    count: z.number().optional(),
    countOnPage: z.number().optional(),
    totalPages: z.number().default(1),
    page: z.number().default(1),
    limit: z.number().optional(),
  }),
  ipos: z.array(z.unknown()).default([]),
});

/** Query validation for the public read-only API / pages. */
export const listQuerySchema = z.object({
  tab: z.enum(["open", "upcoming", "closed"]).catch("open"),
  q: z.string().trim().max(80).catch(""),
  type: z.enum(["all", "EQ", "SME", "DEBT"]).catch("all"),
  sort: z.enum(["closing", "newest", "name", "size"]).catch("closing"),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const slugListSchema = z
  .string()
  .max(2000)
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 100))
  .pipe(z.array(z.string().regex(/^[a-z0-9][a-z0-9-_.]{0,127}$/i)));

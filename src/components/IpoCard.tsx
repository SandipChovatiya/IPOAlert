import Link from "next/link";
import type { Ipo } from "@/lib/db";
import { fmtDate, fmtIssueSize, fmtPriceBand, fmtReturn, inr, returnSinceIssue, timing } from "@/lib/format";
import { StatusBadge, TypeBadge } from "./Badges";
import CompanyLogo from "./CompanyLogo";
import WatchButton from "./WatchButton";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}

export default function IpoCard({ ipo }: { ipo: Ipo }) {
  const t = timing(ipo);
  const times = ipo.subscription?.timesSubscribed;
  return (
    <article className="card lift relative flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <CompanyLogo src={ipo.logo} name={ipo.name} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">
            <Link href={`/ipo/${ipo.slug}`} className="after:absolute after:inset-0 after:content-[''] hover:underline">
              {ipo.name}
            </Link>
          </h3>
          <p className="text-xs text-muted">{ipo.symbol}</p>
        </div>
        <div className="relative z-10">
          <WatchButton slug={ipo.slug} name={ipo.name} compact />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ipo.status} />
        <TypeBadge type={ipo.type} />
        {t.text ? (
          <span className="text-xs font-medium" style={{ color: t.urgent ? "var(--danger)" : "var(--muted)" }}>
            {t.text}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Price band" value={fmtPriceBand(ipo.priceRange)} />
        <Stat label="Issue size" value={fmtIssueSize(ipo.issueSize)} />
        <Stat label="Min. investment" value={inr(ipo.minAmount)} />
        <Stat label="Dates" value={`${fmtDate(ipo.startDate).slice(0, 6)} → ${fmtDate(ipo.endDate).slice(0, 6)}`} />
      </dl>

      {ipo.status === "open" && times != null ? (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Subscription</span>
            <span className="font-semibold text-ink">{times.toFixed(2)}x</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Subscribed ${times.toFixed(2)} times`}>
            <div className="h-full rounded-full bg-open" style={{ width: `${Math.min(100, times * 50)}%` }} />
          </div>
        </div>
      ) : null}

      {ipo.status === "listed" && ipo.listingGain ? (
        <p className="text-sm">
          Listing gain: <strong>{ipo.listingGain}</strong>
        </p>
      ) : null}

      {ipo.status === "listed" && ipo.cmp != null ? (
        <p className="text-sm">
          CMP: <strong>₹{ipo.cmp.toLocaleString("en-IN")}</strong>{" "}
          <span className="text-muted">({fmtReturn(returnSinceIssue(ipo.cmp, ipo.priceRange))} vs issue)</span>
        </p>
      ) : null}
    </article>
  );
}

/** Tiny dependency-free SVG line chart of "times subscribed" over time. */
export default function SubscriptionChart({ points }: { points: { t: number; at: string }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted">Trend appears after a few updates — the agents record a snapshot on every sync.</p>;
  }
  const W = 560, H = 160, P = { l: 36, r: 12, t: 12, b: 24 };
  const xs = points.map((p) => Date.parse(p.at));
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const yMax = Math.max(1, ...points.map((p) => p.t)) * 1.15;
  const X = (v: number) => P.l + ((v - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const Y = (v: number) => H - P.b - (v / yMax) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(Date.parse(p.at)).toFixed(1)},${Y(p.t).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Subscription trend, latest ${last.t.toFixed(2)} times`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={Y(yMax * f * 0.87)} y2={Y(yMax * f * 0.87)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={P.l - 6} y={Y(yMax * f * 0.87) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {(yMax * f * 0.87).toFixed(1)}x
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(Date.parse(last.at))} cy={Y(last.t)} r="4" fill="var(--accent)" />
      </svg>
    </figure>
  );
}

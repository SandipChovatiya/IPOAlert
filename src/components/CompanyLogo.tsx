/* Remote logos: plain <img> with no-referrer; only http(s) URLs ever reach the DB (see schemas.ts). */
export default function CompanyLogo({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const box = { width: size, height: size };
  if (!src) {
    return (
      <div className="grid shrink-0 place-items-center rounded-xl bg-accent-soft font-bold text-accent" style={{ ...box, fontSize: size / 2.8 }} aria-hidden="true">
        {initials}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-xl border border-border bg-white object-contain"
      style={box}
    />
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg px-6 py-14 text-center">
      <p className="text-4xl font-bold">404</p>
      <p className="mt-2 text-muted">We couldn&apos;t find that page or IPO.</p>
      <Link href="/" className="btn btn-primary mt-5">Back to IPOs</Link>
    </div>
  );
}

"use client";

/* Generic message only — details stay in server logs, never in the page. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg px-6 py-14 text-center">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="mt-1 text-sm text-muted">Please try again in a moment.</p>
      <button className="btn btn-primary mt-5" onClick={reset}>Try again</button>
    </div>
  );
}

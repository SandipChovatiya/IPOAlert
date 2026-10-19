import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import Reminders from "@/components/Reminders";
import { lastSync } from "@/lib/db";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "IPO Watch — Open, upcoming & closed IPOs", template: "%s · IPO Watch" },
  description: "Track open, upcoming and closed Indian IPOs with price bands, dates, subscription status and reminders.",
};
export const viewport: Viewport = { colorScheme: "light dark" };

const NAV = [
  { href: "/", label: "IPOs" },
  { href: "/calendar", label: "Calendar" },
  { href: "/watchlist", label: "Watchlist" },
];

async function SyncChip() {
  const s = await lastSync().catch(() => null);
  if (!s) return <span className="text-xs text-muted">Not synced yet</span>;
  const ist = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s.at));
  return <span className="text-xs text-muted">Updated {ist} IST</span>;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const t = (await cookies()).get("theme")?.value;
  const theme = t === "light" || t === "dark" ? t : "system";
  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-contrast" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
                </svg>
              </span>
              IPO Watch
            </Link>
            <nav aria-label="Main" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <SyncChip />
              <ThemeToggle initial={theme} />
            </div>
          </div>
        </header>
        <Reminders />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          <p className="mx-auto max-w-2xl px-4">
            Issue data from NSE India&apos;s public IPO listings (company details from ipoalerts.in where available), refreshed by background
            agents. Unofficial and may lag. For information only — not investment advice. Always read the prospectus before applying.
          </p>
        </footer>
      </body>
    </html>
  );
}

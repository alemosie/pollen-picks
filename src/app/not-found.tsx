import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PollenScatter } from "@/components/PollenScatter";

// Shown for any address that doesn't exist (the response status is 404). The same scattered pollen as the login page, along the bottom.
export const metadata = { title: "Page not found · Pollen Picks", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <PollenScatter />
      <main className="relative mx-auto flex max-w-3xl flex-col px-6 pb-24 pt-6">
        <header className="mb-16 sm:mb-24">
          <Logo height={48} href="/" />
        </header>
        <p className="m-0 font-display text-6xl sm:text-7xl" aria-hidden>
          404
        </p>
        <h1 className="mb-3 mt-2 text-4xl sm:text-5xl">This page blew away.</h1>
        <p className="mb-8 max-w-xl text-lg">
          We couldn&rsquo;t find what you were looking for. The link may be a little off, or the page may have moved on to a new patch.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-honey px-6 py-3 text-center font-bold text-ink-deep hover:brightness-95">
            <ArrowLeft aria-hidden className="size-4" strokeWidth={2.5} /> Back to home
          </Link>
          <Link href="/demo" className="rounded-xl bg-surface px-6 py-3 text-center font-bold ring-1 ring-ink/15 hover:ring-ink/40">
            Try the demo
          </Link>
        </div>
      </main>
    </div>
  );
}

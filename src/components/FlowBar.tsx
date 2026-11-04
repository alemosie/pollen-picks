"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { setNextStep, type NextStep } from "@/lib/nextStep";

/** The one place to move through the flow: Back on the left, what's selected in the middle, the main action on the right. */
export function FlowBar({
  back,
  status,
  next,
  children,
}: {
  back?: { href: string; label: string };
  status?: ReactNode;
  /** Where the main action goes, once it is ready (null while it isn't). The progress indicator reveals the same link. */
  next?: NextStep;
  children?: ReactNode;
}) {
  const nextHref = next?.href ?? null;
  const onNavigate = next?.onNavigate;
  useEffect(() => {
    setNextStep(nextHref ? { href: nextHref, onNavigate } : null);
    return () => setNextStep(null);
    // onNavigate is a stable module function at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextHref]);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-ink text-cream shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
        {back && (
          <Link href={back.href} className="shrink-0 rounded-xl px-4 py-3 font-bold ring-1 ring-cream/40 hover:bg-cream/15">
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        <div className="min-w-0 flex-1" />
        {status && (
          <div className="min-w-0 text-right text-sm font-semibold" aria-live="polite">
            {status}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-3">{children}</div>
      </div>
    </div>
  );
}

/** The main action. Lives on the dark bar, so it is honey with dark text. */
export const primaryButton = "rounded-xl bg-honey px-6 py-3 font-bold text-ink-deep hover:brightness-95";
export const primaryDisabled = "rounded-xl bg-cream/15 px-6 py-3 font-bold text-cream/50";

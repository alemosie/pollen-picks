"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import {
  clearProgress,
  loadProgress,
  STEP_NAMES,
  type Progress,
} from "@/lib/progress";

/** "Pick up where you left off", shown only if a saved step exists and is past the first one. */
export function ResumeBanner({
  className = "",
  inline = false,
  bar = false,
}: {
  className?: string;
  inline?: boolean;
  bar?: boolean;
}) {
  const [saved, setSaved] = useState<Progress | null>(null);
  useEffect(() => {
    const p = loadProgress();
    // Defer so the first client render matches the server HTML.
    const t = setTimeout(
      () => setSaved(p && p.step >= 2 && p.href.startsWith("/") ? p : null),
      0,
    );
    return () => clearTimeout(t);
  }, []);
  if (!saved) return null;
  if (bar)
    return (
      <FlowBar status={`You left off at ${STEP_NAMES[saved.step - 1]}.`}>
        <button
          type="button"
          onClick={() => {
            clearProgress();
            setSaved(null);
          }}
          className="font-semibold underline underline-offset-4"
        >
          Start over
        </button>
        <Link href={saved.href} className={primaryButton}>
          Continue
        </Link>
      </FlowBar>
    );
  if (inline)
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>You left off at {STEP_NAMES[saved.step - 1]}.</span>
        <Link
          href={saved.href}
          className="underline decoration-coral decoration-[3px] underline-offset-4"
        >
          Resume
        </Link>
        <button
          type="button"
          onClick={() => {
            clearProgress();
            setSaved(null);
          }}
          className="font-normal underline underline-offset-4"
        >
          Start over
        </button>
      </span>
    );
  return (
    <div
      role="region"
      aria-label="Resume"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-honey/40 px-4 py-3 text-sm ${className}`}
    >
      <span className="font-semibold">
        You left off at {STEP_NAMES[saved.step - 1]}.
      </span>
      <Link
        href={saved.href}
        className="rounded-lg bg-ink px-3 py-1.5 font-bold text-cream hover:bg-ink-deep"
      >
        Continue
      </Link>
      <button
        type="button"
        onClick={() => {
          clearProgress();
          setSaved(null);
        }}
        className="font-semibold underline underline-offset-4"
      >
        Start over
      </button>
    </div>
  );
}

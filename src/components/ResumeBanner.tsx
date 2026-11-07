"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { useReplaceRun } from "@/components/useReplaceRun";
import { applyOpened, loadSync } from "@/lib/runSync";
import type { OpenedCreation } from "@/lib/savedCreationShape";
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
  const { guard, dialog } = useReplaceRun();
  useEffect(() => {
    const show = (p: Progress | null) => setSaved(p && p.step >= 2 && p.href.startsWith("/") ? p : null);
    const p = loadProgress();
    // Defer so the first client render matches the server HTML.
    const t = setTimeout(() => show(p), 0);
    // The run on the server is the latest if another device wrote it since this browser last wrote or loaded it: then it replaces what this browser had.
    // A signed-out visitor (or the demo) gets a 401 and nothing changes. Only a run that differs from what this browser knows is read in full.
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/run", { cache: "no-store" });
        if (!res.ok) return;
        const s = (await res.json()) as { run: { updatedAt: string } | null };
        if (!s.run || s.run.updatedAt === loadSync().runUpdatedAt) return;
        const full = await fetch("/api/run?open=1", { cache: "no-store" });
        if (!full.ok) return;
        const c = ((await full.json()) as { creation?: OpenedCreation }).creation;
        if (!c || !live) return;
        applyOpened(c, "run");
        show(loadProgress());
      } catch {}
    })();
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, []);
  if (!saved) return null;
  if (bar)
    return (
      <>
      {dialog}
      <FlowBar status={<span className="hidden sm:inline">{`You left off at ${STEP_NAMES[saved.step - 1]}.`}</span>}>
        <button
          type="button"
          onClick={() => void guard(() => {
            clearProgress();
            setSaved(null);
          })}
          className="rounded-xl px-4 py-3 font-bold ring-1 ring-cream/40 hover:bg-cream/15"
        >
          Start over
        </button>
        <Link href={saved.href} className={primaryButton}>
          Continue
        </Link>
      </FlowBar>
      </>
    );
  // On the source step there is no "Start over": choosing a source is the start of a new run, and clears the last one.
  if (inline)
    return (
      <span className="whitespace-nowrap">
        Go back to{" "}
        <Link href={saved.href} className="underline decoration-coral decoration-[3px] underline-offset-4">
          {STEP_NAMES[saved.step - 1]}
        </Link>
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
        onClick={() => void guard(() => {
          clearProgress();
          setSaved(null);
        })}
        className="font-semibold underline underline-offset-4"
      >
        Start over
      </button>
      {dialog}
    </div>
  );
}

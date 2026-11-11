"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { useReplaceRun } from "@/components/useReplaceRun";
import { stepUrl } from "@/lib/flow";
import { applyOpened, loadSync } from "@/lib/runSync";
import type { OpenedCreation } from "@/lib/savedCreationShape";
import {
  clearProgress,
  loadPicked,
  loadProgress,
  STEP_NAMES,
  type Progress,
} from "@/lib/progress";

/** The flow mode a step's address belongs to ("demo" for the public demo's pages). */
const modeOf = (href: string) => {
  const u = new URL(href, "http://x");
  return u.pathname.startsWith("/demo/") ? "demo" : (u.searchParams.get("mode") ?? "");
};
/** Does this step's address carry any picks? */
const picksIn = (href: string) => new URL(href, "http://x").searchParams.get("picks")?.split(",").some(Boolean) ?? false;

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
  // The flow mode of a run whose picks are all gone from its issue (the server says so), so Design has nothing to show. Set from the server's answer.
  const [gone, setGone] = useState<string | null>(null);
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
        const s = (await res.json()) as { run: { source: string; updatedAt: string } | null };
        if (!s.run) return;
        const differs = s.run.updatedAt !== loadSync().runUpdatedAt;
        // From Design on, a run whose picks are gone is worth asking about even when this browser already knows it: there would be nothing to design.
        if (!differs && (loadProgress()?.step ?? 0) < 3) return;
        const full = await fetch("/api/run?open=1", { cache: "no-store" });
        if (!full.ok) {
          const j = (await full.json().catch(() => ({}))) as { picksGone?: boolean };
          if (j.picksGone && live) setGone(s.run.source);
          return;
        }
        if (!differs) return;
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
  // Past Pick, but nothing is picked any more: none saved in this browser (and none in the address it left off at, as with a shared link), or the
  // server says they are gone from the issue. Pick is where to go back to.
  const noPicks = saved.step >= 3 && (gone !== null || ((loadPicked() ?? []).length === 0 && !picksIn(saved.href)));
  const where = noPicks ? { name: STEP_NAMES[1], href: stepUrl(gone ?? modeOf(saved.href), "pick") } : { name: STEP_NAMES[saved.step - 1], href: saved.href };
  if (bar)
    return (
      <>
      {dialog}
      <FlowBar status={<span className="hidden sm:inline">{`You left off at ${where.name}.`}</span>}>
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
        <Link href={where.href} className={primaryButton}>
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
        <Link href={where.href} className="underline decoration-coral decoration-[3px] underline-offset-4">
          {where.name}
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
        You left off at {where.name}.
      </span>
      <Link
        href={where.href}
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

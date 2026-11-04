"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { ResumeBanner } from "@/components/ResumeBanner";
import { clearProgress } from "@/lib/progress";
import { clearDemoRows } from "@/lib/pollen/demoHighlights";

type Source = { id: string; title: string; tag: string; badge?: string; body: ReactNode; tone: string; href?: string };

// Same cards as the signed-in source step (see app/source/ModePicker). Only the demo issue works so far.
const radioDot = (
  <span
    aria-hidden
    className="absolute right-5 top-5 grid size-6 place-items-center rounded-full border-2 border-ink/40 peer-checked:border-ink peer-checked:bg-ink peer-checked:[&>span]:opacity-100"
  >
    <span className="size-2 rounded-full bg-cream opacity-0" />
  </span>
);
const cardBase =
  "relative flex flex-col gap-4 rounded-2xl p-6 outline-offset-4 transition-shadow has-[:checked]:shadow-[0_0_0_3px_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink";

// Starting a demo erases whatever was in progress, including earlier highlights.
function startFresh() {
  clearProgress();
  clearDemoRows();
}

export function DemoSourcePicker({ sources }: { sources: Source[] }) {
  const [chosen, setChosen] = useState(sources[0].id);
  const selected = sources.find((s) => s.id === chosen)!;

  return (
    <div>
      <div role="radiogroup" aria-label="Newsletter source" className="grid gap-5 md:grid-cols-2">
        {sources.map((s) => {
          const ready = Boolean(s.href);
          return (
            <label key={s.id} className={`${cardBase} ${s.tone} ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}>
              <input
                type="radio"
                name="source"
                value={s.id}
                checked={chosen === s.id}
                disabled={!ready}
                onChange={() => setChosen(s.id)}
                className="peer sr-only"
              />
              {ready && radioDot}
              <span className="flex flex-wrap items-center gap-2 pr-8">
                <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">{s.tag}</span>
                {s.badge && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream">{s.badge}</span>}
                {!ready && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream">Coming soon</span>}
              </span>
              <span className="font-display text-2xl">{s.title}</span>
              <span className="leading-relaxed">{s.body}</span>
            </label>
          );
        })}
      </div>

      <FlowBar
        next={selected.href ? { href: selected.href, onNavigate: startFresh } : null}
        status={<ResumeBanner inline />}
      >
        {selected.href && (
          <Link
            href={selected.href}
            onClick={startFresh}
            className={`inline-flex items-center gap-2 ${primaryButton}`}>
            Pick
            <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h13M11 4l6 6-6 6" />
            </svg>
          </Link>
        )}
      </FlowBar>
    </div>
  );
}

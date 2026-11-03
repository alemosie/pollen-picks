"use client";

import Link from "next/link";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { ResumeBanner } from "@/components/ResumeBanner";
import { useState } from "react";

type Mode = { id: "public" | "own"; title: string; tag: string; body: string; tone: string; href?: string; cta: string };

const MODES: Mode[] = [
  {
    id: "own",
    title: "Your newsletter",
    tag: "Pick your own content",
    body: "Connect your Beehiiv API key to share your own content. Unlock top-click ranking and every issue in your archive.",
    tone: "bg-accent",
    cta: "Coming soon",
  },
  {
    id: "public",
    title: "Public newsletter",
    tag: "Pick any content",
    body: "Paste any beehiiv newsletter URL and pick content and links from its latest issue.",
    tone: "bg-card",
    cta: "Coming soon",
  },
];

/** Pick where the content comes from. Source-specific fields will slot in between the cards and the button. */
export function ModePicker() {
  const [mode, setMode] = useState<Mode["id"]>("own");
  const selected = MODES.find((m) => m.id === mode)!;

  return (
    <div>
      <div role="radiogroup" aria-label="Newsletter source" className="grid gap-5 md:grid-cols-2">
        {MODES.map((m) => (
          <label
            key={m.id}
            className={`relative flex cursor-pointer flex-col gap-4 rounded-2xl p-6 outline-offset-4 transition-shadow has-[:checked]:shadow-[0_0_0_3px_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${m.tone}`}
          >
            <input type="radio" name="mode" value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} className="peer sr-only" />
            <span
              aria-hidden
              className="absolute right-5 top-5 grid size-6 place-items-center rounded-full border-2 border-ink/40 peer-checked:border-ink peer-checked:bg-ink peer-checked:[&>span]:opacity-100"
            >
              <span className="size-2 rounded-full bg-cream opacity-0" />
            </span>
            <span className="w-fit rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">{m.tag}</span>
            <span className="font-display text-2xl">{m.title}</span>
            <span className="leading-relaxed">{m.body}</span>
          </label>
        ))}
      </div>

      {/* Setup fields for the chosen source will go here. */}

      <FlowBar status={<ResumeBanner inline />}>
        {selected.href ? (
          <Link href={selected.href} className={`inline-flex items-center gap-2 ${primaryButton}`}>
            {selected.cta}
            <Arrow />
          </Link>
        ) : (
          <span aria-disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border-2 border-dashed border-cream/40 px-6 py-3 font-semibold text-cream/60">
            {selected.cta}
          </span>
        )}
      </FlowBar>
    </div>
  );
}

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h13M11 4l6 6-6 6" />
    </svg>
  );
}

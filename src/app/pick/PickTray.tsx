"use client";

import { Check, Highlighter, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/events";
import { TagChip, type TagState } from "./TagChip";

export type TrayItem = { id: number; text: string; url: string | null; pick: number; tag?: TagState };

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * Your highlights, always in view while you scroll the issue: a card in the bottom right on wide screens, a pill that
 * opens a bottom drawer on phones. It flashes "Saved" when a highlight is added, and shows how much room is left.
 * Sits above the flow bar (about 5rem tall).
 */
export function PickTray({
  items,
  full,
  meter,
  onRemove,
  onToggle,
}: {
  items: TrayItem[];
  /** The pick limit is reached. */
  full: boolean;
  /** The demo's limits, as "of" pairs. Omitted for signed-in users. */
  meter?: { count: number; maxCount: number; words: number; maxWords: number };
  onRemove: (id: number) => void;
  onToggle: (id: number) => void;
}) {
  // null: the default (open on wide screens, closed on phones) until the visitor toggles it.
  const [choice, setChoice] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const prev = useRef(items.length);

  // A new highlight: say so, then fade the note after a moment.
  useEffect(() => {
    if (items.length > prev.current) {
      setSaved(items[items.length - 1]?.text ?? "");
      const t = setTimeout(() => setSaved(null), 2500);
      prev.current = items.length;
      return () => clearTimeout(t);
    }
    prev.current = items.length;
  }, [items]);

  if (items.length === 0 && !saved) return null;
  const picked = items.filter((i) => i.pick > 0).length;
  const near = meter && (meter.count >= meter.maxCount || meter.words >= meter.maxWords * 0.8);

  const label = saved ? (
    <span className="inline-flex items-center gap-1">
      <Check aria-hidden className="size-4" strokeWidth={3} /> Saved
    </span>
  ) : (
    <>Your picks</>
  );
  const visible = choice === null ? "hidden sm:block" : choice ? "block" : "hidden";
  // Open, the panel runs down behind the flow bar. Closed, only its tab is left, and at the very bottom the bar would cover it, with no way to
  // open the list again: so a closed tab sits just above the bar instead (the bar's height is published by FlowBar).
  const lift = "bottom-[var(--flowbar-h,4.75rem)]";
  const place = choice === null ? `${lift} sm:bottom-0` : choice ? "bottom-0" : lift;

  // The same folder look as the picker: a tab on top, attached to a bordered panel. The panel runs down behind the flow
  // bar (z-20 under its z-30), so its bottom edge is straight and its last item is padded clear of the bar.
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-20 flex justify-end px-3 sm:px-6 ${place}`}>
      <div className="pointer-events-auto w-full sm:w-[26rem]">
        <p role="status" className="sr-only">
          {saved ? `Highlight saved: ${clip(saved, 80)}` : ""}
        </p>
        <div className="flex">
          <button
            type="button"
            onClick={() => setChoice(!(choice ?? window.matchMedia("(min-width: 640px)").matches))}
            aria-expanded={choice ?? undefined}
            className={`relative z-10 -mb-[3px] flex items-center gap-2 rounded-t-2xl px-5 py-3 text-base font-bold text-ink-deep transition-colors ${
              saved ? "bg-honey" : "bg-blush"
            }`}
          >
            <Highlighter aria-hidden className="size-4 shrink-0" strokeWidth={2.25} />
            {label}
            <span aria-hidden className="text-xs">▴</span>
          </button>
        </div>
        <div className={`${visible} overflow-hidden rounded-t-2xl rounded-tl-none border-[3px] border-b-0 border-blush bg-surface pt-3 shadow-lg`}>
          <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto px-3 pb-24 pt-1">
            {meter && (
              <p className={`mb-3 mt-0 text-sm font-semibold ${near ? "text-ink-deep" : ""}`}>
                {meter.words} of {meter.maxWords} words. The demo holds up to {meter.maxCount} highlights.
              </p>
            )}
            {meter && (
              <p className="mb-3 mt-0 text-xs">
                Want to try more picks?{" "}
                <a href="/login?next=%2Fsource" onClick={() => track("login_clicked")} className="font-bold underline underline-offset-4">
                  Log in
                </a>{" "}
                to pick up to 20.
              </p>
            )}
            <div>
            <ul aria-label="Your highlights" className="m-0 flex list-none flex-col gap-2 p-0">
              {items.map((h) => {
                const on = h.pick > 0;
                return (
                  <li key={h.id} className={`flex items-start gap-2.5 rounded-xl p-2.5 text-sm ${on ? "bg-blush ring-2 ring-ink" : "bg-card ring-1 ring-ink/10"}`}>
                    {on ? (
                      <span aria-label={`Pick ${h.pick}`} className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-cream">
                        {h.pick}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggle(h.id)}
                        disabled={full}
                        aria-label="Pick this highlight"
                        title="Pick this highlight"
                        className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-ink/30 hover:border-ink/60 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    )}
                    <span className="min-w-0 flex-1 font-semibold leading-snug">
                      {clip(h.text, 110)}
                      <TagChip state={h.tag ?? null} small className="mt-1" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(h.id)}
                      aria-label="Remove this highlight"
                      title={on ? "Remove this pick" : "Remove this highlight"}
                      className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full hover:bg-ink/10"
                    >
                      <X aria-hidden className="size-4" strokeWidth={2.5} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mb-0 mt-2 text-xs">{picked} picked</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

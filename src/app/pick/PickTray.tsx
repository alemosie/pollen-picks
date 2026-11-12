"use client";

import { Check, X } from "lucide-react";
import { PuffIcon } from "@/components/PuffIcon";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/events";
import { TagChip, type TagState } from "./TagChip";
import { PreviewButton } from "./PreviewButton";
import { meterText } from "@/lib/pollen/demoHighlights";

/** A pick. `highlight`: made in the Manual tab. */
export type TrayItem = { id: number; text: string; url: string | null; pick: number; tag?: TagState; highlight?: boolean };

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * Your picks (parsed ones and highlights together), in view on every tab while you scroll: a card in the bottom right on wide
 * screens, a pill that opens a bottom drawer on phones. It flashes "Saved" when a highlight is added, and shows the demo's room left.
 * Sits above the flow bar (about 5rem tall).
 */
export function PickTray({
  mode,
  items,
  full,
  meter,
  note,
  onRemove,
  onToggle,
}: {
  /** The issue the picks are from (a slide preview draws the pick from it). */
  mode: string;
  items: TrayItem[];
  /** The pick limit is reached. */
  full: boolean;
  /** The demo's limits, as "of" pairs. Omitted for signed-in users. */
  meter?: { count: number; maxCount: number; words: number; maxWords: number };
  /** An error from removing a highlight. */
  note?: string | null;
  onRemove: (id: number) => void;
  onToggle: (id: number) => void;
}) {
  // null: the default (open on wide screens, closed on phones) until the visitor toggles it.
  const [choice, setChoice] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const prev = useRef(items.length);

  // A new highlight: say so, then fade the note after a moment.
  useEffect(() => {
    if (items.length > prev.current && items[items.length - 1]?.highlight) {
      setSaved(items[items.length - 1]?.text ?? "");
      const t = setTimeout(() => setSaved(null), 2500);
      prev.current = items.length;
      return () => clearTimeout(t);
    }
    prev.current = items.length;
  }, [items]);

  // Once there has been a pick, the tray stays when the last one is removed, with a prompt to add another; before that it stays out of the way.
  const [had, setHad] = useState(false);
  if (items.length > 0 && !had) setHad(true);
  if (items.length === 0 && !saved && !had) return null;
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
  // Open, the tab is solid ink like the panel it joins. Closed, it is an outline, so it doesn't melt into the dark flow bar below.
  const tabFill = choice === null ? "bg-surface text-ink sm:bg-ink sm:text-cream" : choice ? "bg-ink text-cream" : "bg-surface text-ink";
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
            className={`relative z-10 -mb-[3px] flex items-center gap-2 rounded-t-2xl border-[3px] border-b-0 border-ink px-5 py-3 text-base font-bold transition-colors ${
              saved ? "bg-honey text-ink-deep" : `${tabFill}`
            }`}
          >
            <PuffIcon className="size-5 shrink-0" strokeWidth={1.1} />
            {label}
            <span aria-hidden className="text-xs">▴</span>
          </button>
        </div>
        <div className={`${visible} overflow-hidden rounded-t-2xl rounded-tl-none border-[3px] border-b-0 border-ink bg-surface pt-3 shadow-lg`}>
          <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto px-3 pb-24 pt-1">
            {meter && (
              <p className={`mb-3 mt-0 text-sm font-semibold ${near ? "text-ink-deep" : ""}`}>
                {meterText(meter)}
              </p>
            )}
            {note && <p role="alert" className="mb-3 mt-0 border-l-4 border-coral pl-3 text-sm font-semibold">{note}</p>}
            <div>
            {items.length === 0 && (
              <p role="status" className="m-0 rounded-xl border-2 border-dashed border-ink/25 p-4 text-center text-sm">
                <strong className="block text-base">Add a pick here!</strong>
                Press <strong>+</strong> beside a paragraph in the issue to add it.
              </p>
            )}
            <ul aria-label="Your picks" className="m-0 empty:hidden flex list-none flex-col gap-2 p-0">
              {items.map((h) => {
                const on = h.pick > 0;
                return (
                  <li key={h.id} className={`flex items-start gap-2.5 rounded-xl p-2.5 text-sm ${on ? "bg-ink text-cream" : "bg-card ring-1 ring-ink/10"}`}>
                    {on ? (
                      <span aria-label={`Pick ${h.pick}`} className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-cream text-[11px] font-bold text-ink">
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
                    <span className="-my-0.5 -mr-1 flex shrink-0 items-center">
                      <PreviewButton mode={mode} id={h.id} label={clip(h.text, 40)} className={`size-6 ${on ? "hover:bg-cream/15" : "hover:bg-ink/10"}`} />
                      <button
                        type="button"
                        onClick={() => onRemove(h.id)}
                        aria-label={on ? "Remove this pick" : "Remove this highlight"}
                        title={on ? "Remove this pick" : "Remove this highlight"}
                        className={`grid size-6 shrink-0 place-items-center rounded-full ${on ? "hover:bg-cream/15" : "hover:bg-ink/10"}`}
                      >
                        <X aria-hidden className="size-4" strokeWidth={2.5} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {meter && (
              <p className="mb-0 mt-3 text-xs">
                Want to try more picks?{" "}
                <a href="/login?next=%2Fsource" onClick={() => track("login_clicked")} className="font-bold underline underline-offset-4">
                  Log in
                </a>{" "}
                to pick up to 20.
              </p>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import type { DemoEvent } from "./BuilderDemo";

/** Illustrative handles, not real accounts. */
const TAGS = [
  { id: "host", role: "Organizer", handle: "@eventhost" },
  { id: "venue", role: "Venue", handle: "@thevenue" },
  { id: "instructor", role: "Instructor", handle: "@theinstructor" },
] as const;

/** Where each tag sits on the slide. */
const SPOTS: Record<string, string> = {
  host: "left-3 top-[38%] -rotate-3",
  venue: "right-3 top-[52%] rotate-2",
  instructor: "left-4 bottom-[14%] rotate-1",
};

/** A small, interactive look at tagging: tap who was involved and they show up on the post and in the caption. */
export function TagDemo({ event }: { event: DemoEvent }) {
  const [on, setOn] = useState<string[]>([]);
  const toggle = (id: string) =>
    setOn((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const tagged = TAGS.filter((t) => on.includes(t.id));

  return (
    <div className="grid max-w-3xl items-start gap-6 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8">
      <div
        aria-hidden
        className="relative mx-auto aspect-[4/5] w-full max-w-[15rem] rotate-1 overflow-hidden rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ink/10"
      >
        <p className="font-display text-xl leading-tight">{event.title}</p>
        {event.when && (
          <p className="mt-2 inline-block rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-semibold">
            {event.when}
          </p>
        )}
        {event.place && <p className="mt-2 text-sm">{event.place}</p>}
        {TAGS.map(
          (t) =>
            on.includes(t.id) && (
              <span
                key={t.id}
                className={`pp-pop absolute ${SPOTS[t.id]} rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream shadow`}
              >
                {t.handle}
              </span>
            ),
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink/70">
          Who was involved? Tap to tag them in:
        </p>
        <ul className="m-0 mb-5 flex list-none flex-wrap gap-2 p-0">
          {TAGS.map((t) => {
            const picked = on.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => toggle(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                    picked
                      ? "bg-sage text-ink-deep"
                      : "bg-surface ring-1 ring-ink/15 hover:ring-ink/40"
                  }`}
                >
                  {picked ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                  {t.role}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="rounded-2xl bg-surface p-4 text-[0.95rem] leading-relaxed ring-1 ring-ink/10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/60">
            Caption
          </p>
          <p>
            {event.blurb ? event.blurb : event.title}
            {tagged.length > 0 && (
              <>
                {" "}
                <span className="font-semibold">With </span>
                {tagged.map((t, i) => (
                  <span key={t.id} className="pp-rise">
                    <span className="pp-squig font-semibold">{t.handle}</span>
                    {i < tagged.length - 1 ? ", " : ""}
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

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

/** A slight tilt for each tag so they look stuck on. */
const TILT = ["-rotate-2", "rotate-1", "-rotate-1"];

/** A small, interactive look at tagging: tap who was involved and they show up on the post and in the caption. */
export function TagDemo({ event }: { event: DemoEvent }) {
  const [on, setOn] = useState<string[]>([]);
  const toggle = (id: string) =>
    setOn((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const tagged = TAGS.filter((t) => on.includes(t.id));

  return (
    <div className="grid max-w-3xl items-start gap-6 sm:grid-cols-[1fr_minmax(0,15rem)] sm:gap-8">
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

        <h3 className="mb-2 font-display text-xl leading-tight">Instagram caption</h3>
        <div className="rounded-2xl bg-surface p-4 text-[0.95rem] leading-relaxed ring-1 ring-ink/10">
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
      <div
        aria-hidden
        className="relative aspect-[4/5] w-full max-w-[15rem] rotate-1 overflow-hidden rounded-3xl bg-sage p-5 shadow-sm ring-1 ring-ink/10"
      >
        <p className="font-display text-xl leading-tight">{event.title}</p>
        {event.when && (
          <p className="mt-2 inline-block rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-semibold">
            {event.when}
          </p>
        )}
        {event.place && <p className="mt-2 text-sm">{event.place}</p>}
        {tagged.length > 0 && (
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-1.5">
            {tagged.map((t, i) => (
              <span
                key={t.id}
                className={`pp-pop ${TILT[i % TILT.length]} rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream shadow`}
              >
                {t.handle}
              </span>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

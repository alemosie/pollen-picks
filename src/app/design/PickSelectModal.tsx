"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_PER_SLIDE } from "@/lib/slides/options";

/** Mobile-friendly multi-select: tick up to 4 picks for one slide. Picks already on another slide move here when ticked. */
export function PickSelectModal({
  slideNumber,
  options,
  initial,
  onDone,
  onClose,
}: {
  slideNumber: number;
  options: { id: number; title: string; group?: string; at?: number }[];
  initial: number[];
  onDone: (ids: number[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sel, setSel] = useState<number[]>(initial);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const toggle = (id: number) =>
    setSel((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length >= MAX_PER_SLIDE
          ? s
          : [...s, id],
    );
  const full = sel.length >= MAX_PER_SLIDE;
  /** Ids of the run of picks sharing the subsection that starts at index `i`. */
  const run = (i: number) => {
    const ids: number[] = [];
    for (
      let k = i;
      k < options.length && options[k].group === options[i].group;
      k++
    )
      ids.push(options[k].id);
    return ids;
  };
  const toggleGroup = (ids: number[]) =>
    setSel((s) => {
      if (ids.every((id) => s.includes(id)))
        return s.filter((x) => !ids.includes(x));
      const add = ids.filter((id) => !s.includes(id));
      return [...s, ...add.slice(0, Math.max(0, MAX_PER_SLIDE - s.length))];
    });

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="px-5 pb-3 pt-5">
          <h2 className="m-0 text-2xl">Select picks</h2>
          <p className="m-0 mt-1 text-sm">
            For slide {slideNumber} · {sel.length} of {MAX_PER_SLIDE}
            {full && " (full)"}
          </p>
        </div>
        <ul className="m-0 grid min-h-0 flex-1 list-none content-start gap-1.5 overflow-y-auto p-0 px-5 pb-3">
          {options.map((o, i) => {
            const heading =
              o.group && o.group !== options[i - 1]?.group ? o.group : null;
            const gids = heading ? run(i) : [];
            const allOn =
              gids.length > 0 && gids.every((id) => sel.includes(id));
            const someOn = gids.some((id) => sel.includes(id));
            const on = sel.includes(o.id);
            const blocked = full && !on;
            return (
              <li key={o.id}>
                {heading && (
                  <div
                    className={`mb-2 flex items-center justify-between gap-3 ${i > 0 ? "mt-5" : ""}`}
                  >
                    <span
                      className={`min-w-0 truncate rounded-full px-3.5 py-1 text-sm font-bold ring-1 ${allOn ? "bg-ink/10 ring-ink/30" : someOn ? "bg-surface ring-ink/25" : "bg-surface ring-ink/20"}`}
                    >
                      {allOn && "✓ "}
                      {heading} · {gids.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(gids)}
                      className="shrink-0 px-1 py-1.5 text-sm font-bold underline underline-offset-4"
                    >
                      {allOn ? "Clear" : "Select all"}
                    </button>
                  </div>
                )}
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl bg-surface px-3 py-3 text-sm font-semibold ring-1 ${on ? "ring-2 ring-ink" : "ring-ink/10"} ${blocked ? "opacity-45" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={blocked}
                    onChange={() => toggle(o.id)}
                    className={`size-5 shrink-0 accent-[#2b3a36]`}
                  />
                  <span className="min-w-0 flex-1">{o.title}</span>
                  {o.at != null && !on && (
                    <span className="shrink-0 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold">
                      Slide {o.at + 1}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2 border-t border-ink/10 px-5 py-4">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-xl px-4 py-2.5 font-bold ring-1 ring-ink/20 hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onDone(sel);
              ref.current?.close();
            }}
            className="rounded-xl bg-ink px-5 py-2.5 font-bold text-cream"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

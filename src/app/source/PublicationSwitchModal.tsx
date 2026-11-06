"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { PublicationSummary } from "@/components/PublicationSummary";
import type { BeehiivPublication } from "@/lib/beehiiv";

/** Pick which of the connected publications to choose issues from. Only needed for the few people with more than one. */
export function PublicationSwitchModal({
  publications,
  currentId,
  onSelect,
  onClose,
}: {
  publications: BeehiivPublication[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="px-5 pb-3 pt-5">
          <h2 className="m-0 text-2xl">Switch publication</h2>
          <p className="m-0 mt-1 text-sm">Choose which publication to pick an issue from.</p>
        </div>
        <ul className="m-0 grid min-h-0 flex-1 list-none content-start gap-2 overflow-y-auto p-0 px-5 pb-3 pt-1.5">
          {publications.map((p) => {
            const on = p.id === currentId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    onSelect(p.id);
                    ref.current?.close();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left ring-1 ring-ink/10 hover:ring-ink/40 ${on ? "shadow-[0_0_0_3px_var(--color-ink)]" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <PublicationSummary publication={p} avatar="bg-honey" compact />
                  </span>
                  {on && <Check aria-hidden className="size-5 shrink-0" strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end px-5 pb-5 pt-2">
          <button type="button" onClick={() => ref.current?.close()} className="rounded-xl px-4 py-2 font-bold underline underline-offset-4">
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

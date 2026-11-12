"use client";

import { Eye, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { previewMode } from "@/lib/flow";

/**
 * An eye button that shows how one pick looks as a slide: a dialog on wide screens, a bottom sheet on phones. The slide is only drawn
 * once the button is pressed. It is the pick alone on a slide (slide 1 of a one-pick carousel); with more picks, a slide can be shared
 * by two or three, so the real one may look tighter.
 *
 * The dialog is portaled out of the card: inside a card's <label>, a click in the dialog would count as a click on the label and toggle the pick.
 */
export function PreviewButton({ mode, id, label, className = "" }: { mode: string; id: number; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  // null while the slide is being drawn.
  const [shot, setShot] = useState<{ url?: string; error?: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const src = `/api/slide/preview?picks=${id}&n=1${previewMode(mode)}&fmt=web&w=640`;
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  // Fetched here, not left to an <img>, so a refusal shows what the server said (it answers with { error }) instead of a blank picture.
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    let made: string | null = null;
    fetch(src, { signal: ctl.signal })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `The server answered ${res.status}.`);
        }
        made = URL.createObjectURL(await res.blob());
        if (!ctl.signal.aborted) setShot({ url: made });
      })
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return;
        setShot({ error: e instanceof TypeError ? "Couldn't reach Pollen Picks. Check your connection and try again." : e instanceof Error ? e.message : "Couldn't draw this slide." });
      });
    return () => {
      ctl.abort();
      if (made) URL.revokeObjectURL(made);
    };
  }, [open, src]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShot(null);
          setOpen(true);
        }}
        aria-label={`See how this looks on a slide: ${label}`}
        title="See how this looks on a slide"
        className={`grid shrink-0 place-items-center rounded-full ${className || "size-8 hover:bg-ink/10"}`}
      >
        <Eye aria-hidden className="size-4" strokeWidth={2.25} />
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            onClose={() => setOpen(false)}
            onClick={(e) => {
              e.stopPropagation();
              // A press on the backdrop lands on the dialog itself (its content sits in the inner div).
              if (e.target === e.currentTarget) e.currentTarget.close();
            }}
            aria-labelledby={`slide-preview-${id}`}
            className="fixed inset-x-0 bottom-0 left-0 right-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-ink/50 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(26rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
          >
            <div className="p-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <h2 id={`slide-preview-${id}`} className="m-0 text-xl">
                  How this looks on a slide
                </h2>
                <button
                  type="button"
                  onClick={() => dialog.current?.close()}
                  aria-label="Close preview"
                  className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-ink/10"
                >
                  <X aria-hidden className="size-5" strokeWidth={2.5} />
                </button>
              </div>
              <div className="relative mx-auto aspect-[4/5] w-[min(100%,calc(62dvh*0.8))] overflow-hidden rounded-2xl bg-surface ring-1 ring-ink/10">
                {shot?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.url} alt={`Preview of this pick as a slide: ${label}`} className="size-full object-cover" />
                ) : (
                  <p role={shot?.error ? "alert" : "status"} className="absolute inset-0 m-0 grid place-items-center p-4 text-center text-sm font-semibold">
                    {shot?.error ?? "Drawing your slide…"}
                  </p>
                )}
              </div>
              <p className="mb-0 mt-3 text-sm">
                Shown on a slide of its own. With more picks, two or three can share a slide. You can change the text in the next step.
              </p>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

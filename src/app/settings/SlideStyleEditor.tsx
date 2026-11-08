"use client";

import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { SAVED_EVENT } from "@/lib/progress";
import { bumpStyleVersion } from "@/lib/styleVersion";
import { DEFAULT_STYLE, FONT_LABEL, FONT_NOTE, FONTS, SLOT_LABEL, SLOTS, type SlideFont, type SlideStyle, type Slot } from "@/lib/slides/style";

const select = "w-full appearance-none rounded-xl bg-surface py-2.5 pl-4 pr-12 font-bold ring-1 ring-ink/15";

function SlotSelect({ id, label, value, onChange }: { id: string; label: string; value: Slot; onChange: (s: Slot) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-bold">
        {label}
      </label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as Slot)} className={select}>
          {SLOTS.map((o) => (
            <option key={o} value={o}>
              {SLOT_LABEL[o]}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-5 top-1/2 size-4 -translate-y-1/2" strokeWidth={2.5} />
      </div>
    </div>
  );
}

/**
 * Settings > Slide style: what goes in the header's left corner and the footer's two corners, and the font. Every change saves at once and the
 * preview slide redraws with it. The organization itself (name, logo) is set on its own screen; this one only points to it.
 */
export function SlideStyleEditor({ initial, previews, orgFallback }: { initial: SlideStyle; previews: [string, string]; orgFallback?: string }) {
  const [style, setStyle] = useState<SlideStyle>(initial);
  const [srcs, setSrcs] = useState<string[]>(previews);
  const [loaded, setLoaded] = useState<string[]>([]); // addresses whose image has finished loading
  const [slide, setSlide] = useState(0); // which sample slide the carousel shows
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  /** Saves the placement and font choices; the organization fields are not sent, so they are never overwritten from here. */
  async function save(next: SlideStyle) {
    const mine = ++seq.current;
    setStyle(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/slide-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ top: next.top, bottom: next.bottom, bottomRight: next.bottomRight, font: next.font }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; previews?: string[] };
      if (mine !== seq.current) return; // a newer change is already on its way
      if (res.status === 401) setError("Your Buffer login has expired. Log in again, then try once more.");
      else if (!res.ok || !data.previews) setError(data.error ?? "That didn't save. Try again in a moment.");
      else {
        setSrcs(data.previews);
        bumpStyleVersion();
        window.dispatchEvent(new Event(SAVED_EVENT));
      }
    } catch {
      if (mine === seq.current) setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  const change = (patch: Partial<SlideStyle>) => save({ ...style, ...patch });

  async function reset() {
    ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/slide-style", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; previews?: string[] };
      if (!res.ok || !data.previews) setError(data.error ?? "That didn't work. Try again in a moment.");
      else {
        setStyle((s) => ({ ...DEFAULT_STYLE, orgName: s.orgName, orgLogo: s.orgLogo })); // the organization stays
        setSrcs(data.previews);
        bumpStyleVersion();
        window.dispatchEvent(new Event(SAVED_EVENT));
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // Organization is chosen for a corner but nothing is set up for it.
  const orgChosen = style.top === "organization" || style.bottom === "organization" || style.bottomRight === "organization";
  const orgSet = !!style.orgName.trim() || !!style.orgLogo;
  const standard = style.top === DEFAULT_STYLE.top && style.bottom === DEFAULT_STYLE.bottom && style.bottomRight === DEFAULT_STYLE.bottomRight && style.font === DEFAULT_STYLE.font;

  return (
    <section aria-labelledby="slide-style" className="rounded-2xl bg-card p-4 sm:p-6">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="slide-style" className="m-0 text-2xl">
          Slide style
        </h2>
        <span role="status" className="text-sm font-semibold">
          {busy ? "Saving…" : ""}
        </span>
      </div>
      <p className="mb-6 mt-0 text-sm">How the pick slides look. Changes save as you make them and show in the preview.</p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid min-w-0 content-start gap-7">
          <div className="grid gap-4">
            <SlotSelect id="slot-top" label="Header, top left" value={style.top} onChange={(top) => change({ top })} />
            <SlotSelect id="slot-bottom" label="Footer, bottom left" value={style.bottom} onChange={(bottom) => change({ bottom })} />
            <SlotSelect id="slot-bottom-right" label="Footer, bottom right" value={style.bottomRight} onChange={(bottomRight) => change({ bottomRight })} />
          </div>
          {orgChosen && !orgSet && (
            <p className="m-0 -mt-3 border-l-4 border-honey pl-3 text-sm font-semibold">
              {orgFallback ? <>Your organization shows as &ldquo;{orgFallback}&rdquo; from beehiiv, without a logo. </> : <>You haven&rsquo;t set up your organization yet, so that corner stays empty. </>}
              <Link href="/settings?section=organization" className="underline underline-offset-4">
                {orgFallback ? "Add a name or logo" : "Set up your organization"}
              </Link>
              .
            </p>
          )}
          <p className="m-0 -mt-3 text-sm">The page number stays top right. A slide with a category label (like &ldquo;West&rdquo;) shows that in the header instead. &ldquo;Created with Pollen Picks&rdquo; is off unless you choose it for a corner; it is also shown on the first and last slide when you do.</p>

          <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
            <legend className="mb-1 p-0 font-bold">Font</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {FONTS.map((f: SlideFont) => (
                <label
                  key={f}
                  className="flex cursor-pointer flex-col gap-0.5 rounded-xl bg-surface p-3 ring-1 ring-ink/15 transition hover:ring-ink/40 has-[:checked]:ring-2 has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
                >
                  <input type="radio" name="slide-font" value={f} checked={style.font === f} onChange={() => change({ font: f })} className="sr-only" />
                  <span className="font-bold">{FONT_LABEL[f]}</span>
                  <span className="text-xs">{FONT_NOTE[f]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
              {error}
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={() => void reset()}
              disabled={standard || busy}
              className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
            >
              <RotateCcw aria-hidden className="size-4" /> Back to the standard look
            </button>
          </div>
        </div>

        <figure className="m-0 max-lg:order-first lg:sticky lg:top-6 lg:self-start" aria-roledescription="carousel" aria-label="Sample slides">
          <div className="max-w-72 lg:max-w-none">
            {srcs.map((src, i) => (
              // Both slides load up front, so flipping between them is instant. The one not shown is hidden from everyone, screen readers included.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={i === 0 ? "A sample slide with no category label, drawn with these settings" : "A sample slide with a category label in its header, drawn with these settings"}
                width={540}
                height={675}
                onLoad={() => setLoaded((l) => [...l, src])}
                className={`aspect-[4/5] w-full rounded-2xl bg-surface ring-1 ring-ink/10 transition-opacity ${i === slide ? "" : "hidden"} ${loaded.includes(src) ? "opacity-100" : "opacity-40"}`}
              />
            ))}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSlide((s) => (s + srcs.length - 1) % srcs.length)}
                aria-label="Previous sample slide"
                className="grid size-9 place-items-center rounded-full bg-surface ring-1 ring-ink/15 hover:ring-ink/40"
              >
                <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} />
              </button>
              <div role="group" aria-label="Choose a sample slide" className="flex items-center gap-2">
                {srcs.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlide(i)}
                    aria-label={`Sample slide ${i + 1}`}
                    aria-current={i === slide ? "true" : undefined}
                    className={`size-3 rounded-full ring-1 ring-ink/40 ${i === slide ? "bg-ink" : "bg-surface hover:bg-ink/20"}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSlide((s) => (s + 1) % srcs.length)}
                aria-label="Next sample slide"
                className="grid size-9 place-items-center rounded-full bg-surface ring-1 ring-ink/15 hover:ring-ink/40"
              >
                <ChevronRight aria-hidden className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <figcaption aria-live="polite" className="mt-2 text-xs">
            {slide === 0 ? "Sample slide 1 of 2. No category label, as on most slides." : "Sample slide 2 of 2. A slide whose picks share a category shows it in the header."} Your own picks use the same style. The background is the first color of{" "}
            <Link href="/settings?section=colors" className="font-semibold underline underline-offset-2">
              your palette
            </Link>
            .
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

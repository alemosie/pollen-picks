"use client";

import { useRef, useState } from "react";
import type { LinkedinFormat } from "@/lib/linkedinFormat";

const OPTIONS: { id: LinkedinFormat; title: string; badge?: string; text: string }[] = [
  {
    id: "pdf",
    title: "PDF carousel",
    badge: "Recommended",
    text: "All your slides in one document that people swipe through on LinkedIn, however many there are. The slides' text is in the PDF too, so screen readers can read it.",
  },
  {
    id: "images",
    title: "Separate images",
    text: "The slides as a set of images. LinkedIn shows several images as a grid with the edges cropped, and takes at most 20. Each image carries its alt text.",
  },
];

/** A few lines that show the difference: one document you swipe, or a grid with its edges cut off. */
function Sketch({ id }: { id: LinkedinFormat }) {
  const slide = "aspect-[4/5] rounded-md bg-honey ring-1 ring-ink/20";
  return id === "pdf" ? (
    <div aria-hidden className="flex items-center gap-1.5">
      <div className={`${slide} w-12`} />
      <div className={`${slide} w-12 opacity-50`} />
      <div className={`${slide} w-12 opacity-25`} />
      <span className="ml-1 text-lg font-bold text-ink/60">&rarr;</span>
    </div>
  ) : (
    <div aria-hidden className="grid w-[6.5rem] grid-cols-2 gap-1 overflow-hidden rounded-md">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="aspect-square rounded-sm bg-honey ring-1 ring-ink/20" />
      ))}
    </div>
  );
}

/** Settings > LinkedIn format: how LinkedIn gets the slides. Saved as soon as one is chosen. */
export function LinkedinFormatEditor({ initial }: { initial: LinkedinFormat }) {
  const [format, setFormat] = useState<LinkedinFormat>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Only the last choice's answer counts, so a quick second click is never overwritten by the first one coming back late.
  const latest = useRef(0);

  async function choose(next: LinkedinFormat) {
    if (next === format && status !== "error") return;
    const before = format;
    const mine = ++latest.current;
    setFormat(next);
    setStatus("saving");
    try {
      const res = await fetch("/api/settings/linkedin-format", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: next }) });
      if (!res.ok) throw new Error(String(res.status));
      if (mine === latest.current) setStatus("saved");
    } catch {
      if (mine !== latest.current) return;
      setFormat(before);
      setStatus("error");
    }
  }

  return (
    <section aria-labelledby="linkedin-format" className="rounded-2xl bg-card p-4 sm:p-6">
      <h2 id="linkedin-format" className="mb-1 text-2xl">
        LinkedIn format
      </h2>
      <p className="mb-5 mt-0 text-sm">
        LinkedIn&rsquo;s own carousel is a PDF, so that is how your slides go to LinkedIn. If you would rather send them as separate images, choose that here. It applies to
        every LinkedIn channel you send to; Instagram and the other networks always get images.
      </p>
      <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">How LinkedIn gets your slides</legend>
        {OPTIONS.map((o) => {
          const on = format === o.id;
          return (
            <label
              key={o.id}
              className={`flex cursor-pointer flex-col gap-3 rounded-2xl bg-surface p-4 transition ${on ? "ring-2 ring-ink" : "ring-1 ring-ink/15 hover:ring-ink/40"}`}
            >
              <span className="flex items-start gap-3">
                <input type="radio" name="linkedin-format" value={o.id} checked={on} onChange={() => choose(o.id)} className="mt-1 size-[18px] shrink-0 accent-ink" />
                <span className="min-w-0 font-bold">
                  {o.title}
                  {o.badge && <span className="ml-2 rounded-full bg-honey px-2 py-0.5 align-middle text-xs font-bold">{o.badge}</span>}
                </span>
              </span>
              <Sketch id={o.id} />
              <span className="text-sm">{o.text}</span>
            </label>
          );
        })}
      </fieldset>
      <p role="status" aria-live="polite" className={`mb-0 mt-4 min-h-5 text-sm font-bold ${status === "error" ? "text-ink-deep" : ""}`}>
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved. The next send to LinkedIn uses this."}
        {status === "error" && "Couldn’t save. Try again in a moment."}
      </p>
      <p className="mb-0 mt-2 text-sm text-ink/70">If LinkedIn doesn&rsquo;t take the PDF for a send, that send goes as images instead, and History says so.</p>
    </section>
  );
}

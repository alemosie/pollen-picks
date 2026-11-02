"use client";

import Link from "next/link";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { useEffect, useState } from "react";
import { planSlides } from "@/lib/slides/plan";
import { TEXT_MAX, templateParams, type TemplateOptions } from "@/lib/slides/options";
import type { SlideItem } from "@/lib/slides/types";

type Texts = Required<Pick<TemplateOptions, "heading" | "closingTitle" | "closingLine" | "cta">>;
const STANDARD_TEXT: Texts = { heading: "This week's picks", closingTitle: "Want the full list?", closingLine: "Read every pick in Just a Phase", cta: "Subscribe · link in bio" };

/** Same value after `ms` of quiet, so typing doesn't re-render every slide on every keystroke. */
function useSettled<T>(value: T, ms = 450): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TemplateEditor({ items, picks, initial }: { items: SlideItem[]; picks: number[]; initial: TemplateOptions }) {
  const startsCustom = Object.values(initial).some(Boolean);
  const [custom, setCustom] = useState(startsCustom);
  const [perSlide, setPerSlide] = useState<0 | 1 | 2 | 3>(initial.perSlide ?? 0); // 0 = automatic
  const [texts, setTexts] = useState<Texts>({
    heading: initial.heading ?? STANDARD_TEXT.heading,
    closingTitle: initial.closingTitle ?? STANDARD_TEXT.closingTitle,
    closingLine: initial.closingLine ?? STANDARD_TEXT.closingLine,
    cta: initial.cta ?? STANDARD_TEXT.cta,
  });

  // Only send what differs from the standard, so "standard" stays an empty, shareable URL.
  const opts: TemplateOptions = custom
    ? {
        perSlide: perSlide || undefined,
        ...Object.fromEntries((Object.keys(texts) as (keyof Texts)[]).filter((k) => texts[k].trim() && texts[k].trim() !== STANDARD_TEXT[k]).map((k) => [k, texts[k].trim()])),
      }
    : {};
  const settled = useSettled(JSON.stringify(opts));
  const applied: TemplateOptions = JSON.parse(settled);

  const slides = planSlides(items, { newsletter: "Just a Phase", ...applied });
  const extra = templateParams(applied).toString();
  const q = picks.join(",");
  const next = `/format?mode=demo&picks=${q}${extra ? `&${extra}` : ""}`;

  const field = (k: keyof Texts, label: string) => (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input value={texts[k]} maxLength={TEXT_MAX[k]} onChange={(e) => setTexts((t) => ({ ...t, [k]: e.target.value }))} className="rounded-xl bg-surface px-3 py-2 font-normal ring-1 ring-ink/15" />
    </label>
  );

  return (
    <>
      <div className="mb-10 grid max-w-2xl gap-5 rounded-2xl bg-card p-6">
        <div role="radiogroup" aria-label="Template" className="flex flex-wrap gap-3">
          {[
            { id: false, title: "Standard", body: "Pollen Picks' default layout and wording." },
            { id: true, title: "Customize", body: "Choose picks per slide and edit the text." },
          ].map((m) => (
            <label key={String(m.id)} className="flex min-w-56 flex-1 cursor-pointer flex-col gap-1 rounded-xl bg-surface px-4 py-3 has-[:checked]:shadow-[0_0_0_3px_var(--color-ink)]">
              <input type="radio" name="template" checked={custom === m.id} onChange={() => setCustom(m.id)} className="sr-only" />
              <span className="font-display text-xl">{m.title}</span>
              <span className="text-sm">{m.body}</span>
            </label>
          ))}
        </div>

        {custom && (
          <div className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Picks per slide</legend>
              <div className="flex flex-wrap gap-2">
                {([0, 1, 2, 3] as const).map((n) => (
                  <label key={n} className="cursor-pointer rounded-xl bg-surface px-4 py-2 font-semibold ring-1 ring-ink/15 has-[:checked]:bg-ink has-[:checked]:text-cream">
                    <input type="radio" name="perSlide" checked={perSlide === n} onChange={() => setPerSlide(n)} className="sr-only" />
                    {n === 0 ? "Automatic" : n}
                  </label>
                ))}
              </div>
            </fieldset>
            {field("heading", "Cover title")}
            {field("closingTitle", "Closing slide title")}
            {field("closingLine", "Closing slide line")}
            {field("cta", "Closing slide button")}
            <button
              type="button"
              onClick={() => {
                setPerSlide(0);
                setTexts(STANDARD_TEXT);
              }}
              className="w-fit text-sm font-semibold underline underline-offset-4"
            >
              Reset to standard
            </button>
          </div>
        )}
      </div>

      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {slides.map((s, i) => (
          <li key={i} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/slide/preview?picks=${q}&n=${i}${extra ? `&${extra}` : ""}`}
              alt={`Slide ${i + 1} of ${slides.length}`}
              width={540}
              height={675}
              loading={i < 5 ? "eager" : "lazy"}
              className="aspect-[4/5] w-full rounded-2xl bg-surface ring-1 ring-ink/10"
            />
            <span className="text-xs font-semibold">
              {i + 1}. {s.kind === "cover" ? "Cover" : s.kind === "closing" ? "Closing" : `${s.items.length} ${s.items.length === 1 ? "pick" : "picks"}`}
            </span>
          </li>
        ))}
      </ol>

      <FlowBar back={{ href: "/pick?mode=demo", label: "Pick" }} status={`${slides.length} slides · ${picks.length} ${picks.length === 1 ? "pick" : "picks"}`}>
        <Link href={next} className={primaryButton}>
          Continue
        </Link>
      </FlowBar>
    </>
  );
}

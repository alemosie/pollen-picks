"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  SPEC_LIMITS,
  templateParams,
  type CustomSpec,
  type PickEdit,
} from "@/lib/slides/options";
import type { SlideItem } from "@/lib/slides/types";
import { oneLineLimit } from "@/lib/slides/plan";
import { usePalette } from "@/components/usePalette";
import { DEFAULT_COLORS, sameColor } from "@/lib/brand";
import { textOn } from "@/app/settings/PaletteEditor";
import { previewMode } from "@/lib/flow";
import { useSettled } from "./useSettled";

export type Target =
  { kind: "cover" } | { kind: "closing" } | { kind: "slide"; index: number };

export const DEFAULTS = {
  coverTitle: "This week's picks",
  closingTitle: "Want the full list?",
  cta: "Subscribe · link in bio",
};

/** Position of a slide in the rendered carousel (empty slides are skipped, the cover is 0). */
export function previewIndex(spec: CustomSpec, target: Target): number {
  const filled = spec.slides.map((g) => g.length > 0);
  if (target.kind === "cover") return 0;
  if (target.kind === "closing") return 1 + filled.filter(Boolean).length;
  return 1 + filled.slice(0, target.index).filter(Boolean).length;
}

export function previewSrc(
  picks: string,
  spec: CustomSpec,
  target: Target,
  mode?: string,
): string {
  const p = templateParams({ spec });
  return `/api/slide/preview?picks=${picks}&n=${previewIndex(spec, target)}&${p.toString()}${previewMode(mode)}`;
}

const input =
  "rounded-xl bg-surface px-3 py-2 font-normal text-ink ring-1 ring-ink/15";

/** Edit the text of one slide. The header and footer belong to the template and aren't editable. */
export function EditSlideModal({
  newsletter,
  target,
  spec,
  items,
  picks,
  mode,
  placed,
  onSave,
  onClose,
}: {
  newsletter: string;
  target: Target;
  spec: CustomSpec;
  items: SlideItem[];
  picks: string;
  mode?: string;
  placed: number;
  onSave: (s: CustomSpec) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<CustomSpec>(() => structuredClone(spec));
  const palette = usePalette();
  const byId = new Map(items.map((i) => [i.id!, i]));
  const settled = useSettled(draft, 500);
  // Edits are batched: nothing reaches the carousel until the window closes (Done, ✕, Esc or a click outside).
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  const closingLineDefault = `Read every pick in ${newsletter}`;
  const coverDefaultSub = `${placed} ${placed === 1 ? "pick" : "picks"} from ${newsletter}`;
  /** Raw drafts keep whatever is typed (even an empty field); this drops anything that is blank or equals the default. */
  const normalize = (d: CustomSpec): CustomSpec => {
    const pick = (
      o: Record<string, string | undefined> | undefined,
      dflt: Record<string, string>,
    ) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(o ?? {}))
        if (v && v.trim() && v.trim() !== dflt[k]) out[k] = v;
      return Object.keys(out).length ? out : undefined;
    };
    const edits: Record<number, PickEdit> = {};
    for (const [key, e] of Object.entries(d.edits ?? {})) {
      const base = byId.get(Number(key));
      const out: PickEdit = {};
      for (const k of Object.keys(e) as (keyof PickEdit)[]) {
        const v = e[k];
        if (v === undefined) continue;
        const original = k === "title" ? base?.title : (base?.[k] ?? "");
        if (v === original || (k === "title" && !v.trim())) continue;
        out[k] = v;
      }
      if (Object.keys(out).length) edits[Number(key)] = out;
    }
    return {
      ...d,
      cover: pick(d.cover, {
        title: DEFAULTS.coverTitle,
        subtitle: coverDefaultSub,
      }),
      closing: pick(d.closing, {
        title: DEFAULTS.closingTitle,
        line: closingLineDefault,
        cta: DEFAULTS.cta,
      }),
      edits: Object.keys(edits).length ? edits : undefined,
      bgs: d.bgs?.some(Boolean) ? d.bgs : undefined,
      hideTags: d.hideTags?.some(Boolean) ? d.hideTags : undefined,
    };
  };
  const closing = () => {
    const next = normalize(latest.current);
    if (JSON.stringify(next) !== JSON.stringify(normalize(spec))) onSave(next);
    onClose();
  };
  const [initialJson] = useState(() => JSON.stringify(normalize(spec)));
  const dirty = JSON.stringify(normalize(draft)) !== initialJson;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const ids = target.kind === "slide" ? (draft.slides[target.index] ?? []) : [];

  const setCover = (k: "title" | "subtitle", v: string) =>
    setDraft((d) => ({ ...d, cover: { ...d.cover, [k]: v } }));
  const setClosing = (k: "title" | "line" | "cta", v: string) =>
    setDraft((d) => ({ ...d, closing: { ...d.closing, [k]: v } }));
  const setEdit = (id: number, key: keyof PickEdit, v: string) =>
    setDraft((d) => ({
      ...d,
      edits: { ...d.edits, [id]: { ...d.edits?.[id], [key]: v } },
    }));

  const nd = normalize(draft);
  const slideIndex = target.kind === "slide" ? target.index : -1;
  const currentBg =
    target.kind === "cover"
      ? draft.cover?.bg
      : target.kind === "closing"
        ? draft.closing?.bg
        : draft.bgs?.[slideIndex];
  const defaultBg =
    target.kind === "cover"
      ? DEFAULT_COLORS.accent
      : target.kind === "closing"
        ? DEFAULT_COLORS.card
        : DEFAULT_COLORS.background;
  const setBg = (v: string) =>
    setDraft((d) => {
      if (target.kind === "cover")
        return { ...d, cover: { ...d.cover, bg: v || undefined } };
      if (target.kind === "closing")
        return { ...d, closing: { ...d.closing, bg: v || undefined } };
      const bgs = [...(d.bgs ?? [])];
      while (bgs.length <= target.index) bgs.push("");
      bgs[target.index] = v;
      return { ...d, bgs };
    });

  /** The color a pick's card has on the slide: the chosen one, else the template's alternating default. */
  const cardColor = (id: number, i: number) =>
    draft.edits?.[id]?.bg ||
    (i % 2 === 0 ? DEFAULT_COLORS.card : DEFAULT_COLORS.accent);

  /** A card that is (nearly) the color of its slide or of this window would vanish, so it gets an outline in both. */
  const blends = (color: string) =>
    sameColor(color, currentBg || DEFAULT_COLORS.background) ||
    sameColor(color, DEFAULT_COLORS.background);

  const hasEdits =
    target.kind === "cover"
      ? !!nd.cover
      : target.kind === "closing"
        ? !!nd.closing
        : ids.some((id) => nd.edits?.[id]) || !!nd.bgs?.[slideIndex] || !!nd.hideTags?.[slideIndex];
  const revert = () =>
    setDraft((d) => {
      if (target.kind === "cover") return { ...d, cover: undefined };
      if (target.kind === "closing") return { ...d, closing: undefined };
      const edits = { ...d.edits };
      for (const id of d.slides[target.index] ?? []) delete edits[id];
      const bgs = [...(d.bgs ?? [])];
      bgs[target.index] = "";
      const hideTags = [...(d.hideTags ?? [])];
      hideTags[target.index] = false;
      return {
        ...d,
        edits: Object.keys(edits).length ? edits : undefined,
        bgs,
        hideTags,
      };
    });

  const value = (id: number, key: keyof PickEdit) =>
    draft.edits?.[id]?.[key] ??
    (key === "title" ? byId.get(id)?.title : byId.get(id)?.[key]) ??
    "";

  const title =
    target.kind === "cover"
      ? "Edit the cover"
      : target.kind === "closing"
        ? "Edit the closing slide"
        : `Edit slide ${target.index + 1}`;

  return (
    <dialog
      ref={ref}
      onClose={closing}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      aria-label={title}
      className="m-auto h-[min(46rem,92vh)] w-[min(60rem,96vw)] overflow-hidden rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 px-7 pb-2 pt-6">
          <h2 className="m-0 text-2xl">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
          >
            <X aria-hidden className="size-5" strokeWidth={2.25} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-7 py-4 md:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="grid content-start gap-3 md:sticky md:top-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc(picks, normalize(settled), target, mode)}
              alt="Slide preview"
              width={540}
              height={675}
              className="aspect-[4/5] w-full rounded-2xl bg-surface ring-1 ring-ink/10"
            />
            {target.kind === "slide" && ids.some((id) => byId.get(id)?.tag) && (
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
                  <input
                    type="checkbox"
                    checked={!draft.hideTags?.[target.index]}
                    onChange={(e) =>
                      setDraft((d) => {
                        const hideTags = [...(d.hideTags ?? [])];
                        while (hideTags.length <= target.index) hideTags.push(false);
                        hideTags[target.index] = !e.target.checked;
                        return { ...d, hideTags };
                      })
                    }
                    aria-describedby="tags-hint"
                    className="size-5 shrink-0 accent-ink"
                  />
                  Credit Instagram accounts
                </label>
                <p id="tags-hint" className="mb-0 mt-1 text-xs">
                  Shows @handle on this slide&rsquo;s picks that link to an Instagram account.
                </p>
              </div>
            )}
          </div>
          <div className="grid content-start gap-5">
            <p className="m-0 text-sm">
              The header and footer are part of the template. Everything else on
              the slide is yours to change.
            </p>

            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-1 p-0 text-sm font-semibold">
                {target.kind === "slide" ? "Slide background" : "Background"}
              </legend>
              <Swatches
                palette={palette}
                value={currentBg}
                fallback={defaultBg}
                onPick={setBg}
                label="Background"
              />
              <a
                href="/settings"
                target="_blank"
                rel="noreferrer"
                className="w-fit text-sm font-semibold underline underline-offset-4"
              >
                Edit your palette in Settings
              </a>
            </fieldset>

            {target.kind === "cover" && (
              <>
                <label className="grid gap-1 text-sm font-semibold">
                  Title
                  <input
                    value={draft.cover?.title ?? DEFAULTS.coverTitle}
                    maxLength={SPEC_LIMITS.coverTitle}
                    onChange={(e) => setCover("title", e.target.value)}
                    className={input}
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Subtitle
                  <input
                    value={draft.cover?.subtitle ?? coverDefaultSub}
                    maxLength={SPEC_LIMITS.coverSubtitle}
                    onChange={(e) => setCover("subtitle", e.target.value)}
                    className={input}
                  />
                </label>
              </>
            )}

            {target.kind === "closing" && (
              <>
                <label className="grid gap-1 text-sm font-semibold">
                  Title
                  <input
                    value={draft.closing?.title ?? DEFAULTS.closingTitle}
                    maxLength={SPEC_LIMITS.closingTitle}
                    onChange={(e) => setClosing("title", e.target.value)}
                    className={input}
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Line
                  <input
                    value={draft.closing?.line ?? closingLineDefault}
                    maxLength={SPEC_LIMITS.closingLine}
                    onChange={(e) => setClosing("line", e.target.value)}
                    className={input}
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Button
                  <input
                    value={draft.closing?.cta ?? DEFAULTS.cta}
                    maxLength={SPEC_LIMITS.cta}
                    onChange={(e) => setClosing("cta", e.target.value)}
                    className={input}
                  />
                </label>
              </>
            )}

            {target.kind === "slide" &&
              ids.map((id, i) => (
                <fieldset
                  key={id}
                  style={{
                    background: cardColor(id, i),
                    color: textOn(cardColor(id, i)),
                  }}
                  className={`grid gap-3 rounded-2xl p-4 transition-colors ${blends(cardColor(id, i)) ? "ring-2 ring-current" : ""}`}
                >
                  <legend className="sr-only">Pick {i + 1}</legend>
                  <h3 className="m-0 text-2xl">Pick {i + 1}</h3>
                  <label className="grid gap-1 text-sm font-semibold">
                    Title
                    <input
                      value={value(id, "title")}
                      maxLength={SPEC_LIMITS.title}
                      onChange={(e) => setEdit(id, "title", e.target.value)}
                      className={input}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold">Card color</span>
                    <Swatches
                      palette={palette}
                      value={draft.edits?.[id]?.bg}
                      fallback={
                        i % 2 === 0
                          ? DEFAULT_COLORS.card
                          : DEFAULT_COLORS.accent
                      }
                      onPick={(v) => setEdit(id, "bg", v)}
                      label={`Card color for pick ${i + 1}`}
                      size="sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">
                      Date &amp; time
                      <input
                        value={value(id, "when")}
                        maxLength={SPEC_LIMITS.when}
                        onChange={(e) => setEdit(id, "when", e.target.value)}
                        className={input}
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Place
                      <input
                        value={value(id, "place")}
                        maxLength={SPEC_LIMITS.place}
                        onChange={(e) => setEdit(id, "place", e.target.value)}
                        className={input}
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm font-semibold">
                    Description
                    <textarea
                      value={value(id, "blurb")}
                      maxLength={SPEC_LIMITS.blurb}
                      rows={4}
                      onChange={(e) => setEdit(id, "blurb", e.target.value)}
                      className={input}
                    />
                    {ids.length >= 3 && (
                      <span className="mt-1.5 text-xs font-normal">
                        <strong>
                          {value(id, "blurb").length} /{" "}
                          {oneLineLimit(ids.length)} characters
                        </strong>{" "}
                        · with {ids.length} picks on a slide, descriptions are
                        cut off at {oneLineLimit(ids.length)} characters.
                      </span>
                    )}
                  </label>
                </fieldset>
              ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-7 py-5">
          <div className="flex items-center gap-4">
            <p
              role="status"
              className="m-0 flex items-center gap-2 text-sm font-semibold"
            >
              {dirty ? (
                <>
                  <span className="text-coral">Unsaved changes</span> · Press
                  Done to save
                </>
              ) : (
                "Press Done to save your changes"
              )}
            </p>
            {hasEdits && (
              <button
                type="button"
                onClick={revert}
                className="text-sm font-bold underline underline-offset-4"
              >
                {target.kind === "slide"
                  ? "Revert this slide"
                  : target.kind === "cover"
                    ? "Revert the cover"
                    : "Revert the closing slide"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-xl bg-ink px-6 py-3 font-bold text-cream hover:bg-ink-deep"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Default swatch plus the palette. `value` "" / undefined means default. */
function Swatches({
  palette,
  value,
  fallback,
  onPick,
  label,
  size = "md",
}: {
  palette: string[];
  value?: string;
  fallback: string;
  onPick: (hex: string) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-7" : "size-9";
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
    >
      {[
        { hex: "", label: "Default" },
        ...palette.map((hex) => ({ hex, label: hex })),
      ].map((o) => {
        const on = (value ?? "").toLowerCase() === o.hex;
        const shown = o.hex || fallback;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onPick(o.hex)}
            aria-pressed={on}
            aria-label={o.hex ? `${label} ${o.hex}` : `${label}: default`}
            title={o.hex || "Default"}
            style={{ background: shown }}
            className={`grid ${dim} place-items-center rounded-full text-xs font-bold ring-1 ring-ink/20 ${on ? "outline-2 outline-offset-2 outline-current" : "hover:ring-ink/50"}`}
          >
            {!o.hex && <span style={{ color: textOn(shown) }}>A</span>}
            {on && o.hex && (
              <Check
                aria-hidden
                className="size-4"
                strokeWidth={3}
                style={{ color: textOn(o.hex) }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

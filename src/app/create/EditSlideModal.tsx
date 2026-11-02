"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  SPEC_LIMITS,
  templateParams,
  type CustomSpec,
  type PickEdit,
} from "@/lib/slides/options";
import type { SlideItem } from "@/lib/slides/types";
import { useSettled } from "./useSettled";

export type Target =
  { kind: "cover" } | { kind: "closing" } | { kind: "slide"; index: number };

export const DEFAULTS = {
  coverTitle: "This week's picks",
  closingTitle: "Want the full list?",
  closingLine: "Read every pick in Just a Phase",
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
): string {
  const p = templateParams({ spec });
  return `/api/slide/preview?picks=${picks}&n=${previewIndex(spec, target)}&${p.toString()}`;
}

const input = "rounded-xl bg-surface px-3 py-2 font-normal ring-1 ring-ink/15";

/** Edit the text of one slide. The header and footer belong to the template and aren't editable. */
export function EditSlideModal({
  target,
  spec,
  items,
  picks,
  placed,
  onSave,
  onClose,
}: {
  target: Target;
  spec: CustomSpec;
  items: SlideItem[];
  picks: string;
  placed: number;
  onSave: (s: CustomSpec) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<CustomSpec>(() => structuredClone(spec));
  const byId = new Map(items.map((i) => [i.id!, i]));
  const settled = useSettled(draft, 500);
  // Edits are batched: nothing reaches the carousel until the window closes (Done, ✕, Esc or a click outside).
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  const coverDefaultSub = `${placed} ${placed === 1 ? "pick" : "picks"} from Just a Phase`;
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
        line: DEFAULTS.closingLine,
        cta: DEFAULTS.cta,
      }),
      edits: Object.keys(edits).length ? edits : undefined,
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
  const hasEdits =
    target.kind === "cover"
      ? !!nd.cover
      : target.kind === "closing"
        ? !!nd.closing
        : ids.some((id) => nd.edits?.[id]);
  const revert = () =>
    setDraft((d) => {
      if (target.kind === "cover") return { ...d, cover: undefined };
      if (target.kind === "closing") return { ...d, closing: undefined };
      const edits = { ...d.edits };
      for (const id of d.slides[target.index] ?? []) delete edits[id];
      return { ...d, edits: Object.keys(edits).length ? edits : undefined };
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc(picks, normalize(settled), target)}
            alt="Slide preview"
            width={540}
            height={675}
            className="aspect-[4/5] w-full rounded-2xl bg-surface ring-1 ring-ink/10 md:sticky md:top-0"
          />
          <div className="grid content-start gap-5">
            <p className="m-0 text-sm">
              The header and footer are part of the template. Everything else on
              the slide is yours to change.
            </p>

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
                    value={draft.closing?.line ?? DEFAULTS.closingLine}
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
                  className="grid gap-3 rounded-2xl bg-card p-4"
                >
                  <legend className="px-1 text-sm font-bold">
                    Pick {i + 1}
                  </legend>
                  <label className="grid gap-1 text-sm font-semibold">
                    Title
                    <input
                      value={value(id, "title")}
                      maxLength={SPEC_LIMITS.title}
                      onChange={(e) => setEdit(id, "title", e.target.value)}
                      className={input}
                    />
                  </label>
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
                      <span className="text-xs font-normal">
                        {value(id, "blurb").length} characters · with{" "}
                        {ids.length} picks on a slide, only the first line
                        shows.
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

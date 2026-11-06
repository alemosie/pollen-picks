"use client";

import Link from "next/link";
import { SavedFlash } from "@/components/SavedFlash";
import { StepWord } from "@/components/StepWord";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { useMemo, useState, useSyncExternalStore } from "react";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { isDemo, previewMode, stepUrl } from "@/lib/flow";
import {
  saveTemplate,
  templateSnapshot,
  type TemplateState,
} from "@/lib/progress";
import {
  templateParams,
  type CustomSpec,
  type TemplateOptions,
} from "@/lib/slides/options";
import { planSlides } from "@/lib/slides/plan";
import type { SlideItem } from "@/lib/slides/types";
import { FlowLoader } from "@/components/FlowLoader";
import { useLoaderVisible } from "@/components/useLoaderVisible";
import { SlideBuilder } from "./SlideBuilder";
import { useSlidesReady } from "./useSlidesReady";

/** URLs longer than this risk being refused by servers or proxies. */
const SPEC_WARN = 6000;

export function TemplateEditor({
  mode,
  issueKey,
  newsletter,
  items,
  picks,
  initial,
}: {
  /** Content source: "demo" is the public sample, with its own /demo pages. */
  mode: string;
  /** The issue's address: a saved layout is only restored for the same issue even when `mode` is the same. */
  issueKey?: string;
  /** The newsletter's name, used in slide and caption wording. */
  newsletter: string;
  items: SlideItem[];
  picks: number[];
  initial: TemplateOptions;
}) {
  const scope = issueKey ? `${mode}|${issueKey}` : mode;
  // The URL only carries a layout once you've moved on; otherwise pick up where you left off (mode and slides) from this browser.
  const stored = useSyncExternalStore(
    () => () => {},
    templateSnapshot,
    () => null,
  );
  const saved = useMemo<TemplateState | null>(() => {
    try {
      const t = stored ? (JSON.parse(stored) as TemplateState) : null;
      // Slide ids belong to one issue: a layout saved for another issue (or before layouts were scoped) is not restored.
      return t?.spec?.slides?.length && t.scope === scope ? t : null;
    } catch {
      return null;
    }
  }, [stored, scope]);
  const base: TemplateState = initial.spec ? { custom: true, spec: initial.spec } : (saved ?? { custom: false, spec: { slides: [[]] } });
  const [mine, setMine] = useState<TemplateState | null>(null);
  const { custom, spec } = mine ?? base;
  const update = (t: TemplateState) => {
    setMine(t);
    saveTemplate({ ...t, scope });
  };
  // Turning Customize on with nothing placed starts with the first pick on the first slide, so there is something to build from.
  const setCustom = (c: boolean) => {
    const nothingPlaced = spec.slides.every((g) => !g.some((id) => picks.includes(id)));
    update({ custom: c, spec: c && nothingPlaced && picks.length > 0 ? { ...spec, slides: [[picks[0]]] } : spec });
  };
  const setSpec = (sp: CustomSpec) => update({ custom, spec: sp });

  const poolIds = new Set(picks);
  // Only picks still selected on /pick can be on a slide.
  const clean: CustomSpec = {
    ...spec,
    slides: spec.slides.map((g) => g.filter((id) => poolIds.has(id))),
  };
  const placed = clean.slides.flat().length;
  const slideCount = clean.slides.filter((g) => g.length).length;

  const applied: TemplateOptions = { ...(custom ? { spec: clean } : {}), sv: initial.sv };
  const extra = templateParams(applied).toString();
  const q = picks.join(",");
  const query = `picks=${q}${extra ? `&${extra}` : ""}`;
  const demo = isDemo(mode);
  const next = stepUrl(mode, "write", query);

  const shareUrl = () => `${window.location.origin}${stepUrl(mode, "design", query)}`;

  const standard = planSlides(items, { newsletter });
  // Keep the loading animation up until the first previews have arrived, so the page never shows empty slide frames.
  const slidesReady = useSlidesReady();
  // The editor stays hidden (not faded: hidden) until then, so nothing of it shows before the loader decides to appear. The
  // loader itself only comes up if the previews take a moment, so quick loads just show the editor.
  const showLoader = useLoaderVisible(!slidesReady);

  return (
    <>
      {showLoader && <FlowLoader instant label="Setting up your carousel…" />}
      <div className={slidesReady ? undefined : "invisible"} aria-busy={!slidesReady}>
        <div className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <h1 className="mb-3 text-4xl sm:text-5xl">
              <StepWord>Design</StepWord> your carousel
            </h1>
            <div className="flex shrink-0 items-center gap-3 sm:mt-2">
              <SavedFlash />
              <ShareLinkButton
                getUrl={shareUrl}
                title={demo ? "Anyone with this link can open this demo, no account needed" : undefined}
              />
            </div>
          </div>
          <p className="mb-0 max-w-2xl text-lg">
            Use the standard layout, or build your own slides.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div role="radiogroup" aria-label="Template" className="flex gap-2">
            {[
              { id: false, title: "Standard" },
              { id: true, title: "Customize" },
            ].map((m) => (
              <label
                key={String(m.id)}
                className="cursor-pointer rounded-xl bg-surface px-5 py-2.5 font-bold ring-1 ring-ink/15 transition hover:ring-ink/40 has-[:checked]:bg-ink has-[:checked]:text-cream has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
              >
                <input
                  type="radio"
                  name="template"
                  checked={custom === m.id}
                  onChange={() => setCustom(m.id)}
                  className="sr-only"
                />
                {m.title}
              </label>
            ))}
          </div>
          <p className="m-0 flex-1 text-sm">
            {custom
              ? "Drag picks into your own slides, and click any slide to edit its text."
              : "Pollen Picks' default layout and wording."}
          </p>
        </div>

        {custom ? (
          <SlideBuilder
            newsletter={newsletter}
            items={items}
            picks={q}
            mode={mode}
            spec={clean}
            styleVersion={initial.sv}
            onChange={setSpec}
          />
        ) : (
          <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {standard.map((s, i) => (
              <li key={i} className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/slide/preview?picks=${q}&n=${i}${initial.sv ? `&sv=${initial.sv}` : ""}${previewMode(mode)}`}
                  alt={`Slide ${i + 1} of ${standard.length}`}
                  width={540}
                  height={675}
                  loading={i < 5 ? "eager" : "lazy"}
                  className="aspect-[4/5] w-full rounded-2xl bg-surface ring-1 ring-ink/10"
                />
                <span className="text-xs font-semibold">
                  {i + 1}.{" "}
                  {s.kind === "cover"
                    ? "Cover"
                    : s.kind === "closing"
                      ? "Closing"
                      : `${s.items.length} ${s.items.length === 1 ? "pick" : "picks"}`}
                </span>
              </li>
            ))}
          </ol>
        )}

        <FlowBar
          next={custom && (placed === 0 || extra.length > SPEC_WARN) ? null : { href: next }}
          back={{ href: stepUrl(mode, "pick"), label: "Pick" }}
          status={
            custom
              ? extra.length > SPEC_WARN
                ? "Heavy customization: trim some text"
                : placed === 0
                  ? "Drag at least one pick onto a slide"
                  : `${slideCount + 2} slides · ${placed} of ${picks.length} picks placed`
              : `${standard.length} slides · ${picks.length} ${picks.length === 1 ? "pick" : "picks"}`
          }
        >
          {custom && (placed === 0 || extra.length > SPEC_WARN) ? (
            <span aria-disabled className={primaryDisabled}>
              Continue
            </span>
          ) : (
            <Link href={next} className={primaryButton}>
              Continue
            </Link>
          )}
        </FlowBar>
      </div>
    </>
  );
}

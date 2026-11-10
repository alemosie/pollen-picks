"use client";

import Link from "next/link";
import { SavedFlash } from "@/components/SavedFlash";
import { StepWord } from "@/components/StepWord";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { useMemo, useState, useSyncExternalStore } from "react";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { RunAutosave } from "@/components/RunAutosave";
import { SaveCreationButton } from "@/components/SaveCreationButton";
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
import type { IssueImage } from "@/lib/pollen/imageIds";
import type { SlideItem } from "@/lib/slides/types";
import { useStyleVersion } from "@/lib/useStyleVersion";
import type { Channel } from "@/components/ChannelPicker";
import type { BrandInfo } from "@/lib/brandSummary";
import { usePalette } from "@/components/usePalette";
import { palParam } from "@/lib/palette";
import { BrandPanel } from "./BrandPanel";
import { SlideBuilder } from "./SlideBuilder";
import { SlideFit } from "./SlideFit";
import { SlidesReadyGate } from "./SlidesReadyGate";
import { SlidePreview } from "./SlidePreview";

/** URLs longer than this risk being refused by servers or proxies. */
const SPEC_WARN = 6000;

export function TemplateEditor({
  mode,
  issueKey,
  newsletter,
  items,
  images,
  picks,
  channels,
  brand,
  initial,
}: {
  /** Content source: "demo" is the public sample, with its own /demo pages. */
  mode: string;
  /** The issue's address: a saved layout is only restored for the same issue even when `mode` is the same. */
  issueKey?: string;
  /** The newsletter's name, used in slide and caption wording. */
  newsletter: string;
  items: SlideItem[];
  /** Pictures found in the issue, offered for the picks' cards (undefined: this source has none to offer). */
  images?: IssueImage[];
  picks: number[];
  /** The channels the carousel can go to, to say how many slides each takes (none: nothing to show). */
  channels?: Channel[];
  /** The organization name and logo saved in Settings, for the "Your brand" strip (none: nothing is set, as in the demo). */
  brand?: BrandInfo;
  initial: TemplateOptions;
}) {
  const scope = issueKey ? `${mode}|${issueKey}` : mode;
  // A style changed in Settings since this page was drawn shows at once, even if the page itself was not rendered again.
  const sv = useStyleVersion(initial.sv);
  // The demo has no account to keep a palette in: the one chosen in this browser rides along in the slide addresses (and on to the next steps).
  const palette = usePalette();
  const pal = isDemo(mode) ? palParam(palette) : undefined;
  // The URL only carries a layout once you've moved on; otherwise pick up where you left off (mode and slides) from this browser.
  // undefined = not read yet (the server, and the first client render): the page doesn't know yet whether a saved layout exists.
  const stored = useSyncExternalStore<string | null | undefined>(
    () => () => {},
    () => templateSnapshot(),
    () => undefined,
  );
  const layoutKnown = stored !== undefined || !!initial.spec;
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
  // Turning Customize on with nothing placed fills all slides, the way the standard layout would (the same as "Fill all slides"), so there is something to build from.
  const setCustom = (c: boolean) => {
    const nothingPlaced = spec.slides.every((g) => !g.some((id) => picks.includes(id)));
    if (!(c && nothingPlaced && picks.length > 0)) return update({ custom: c, spec });
    const filled = planSlides(items, { newsletter }).flatMap((sl) => (sl.kind === "picks" ? [sl.items.map((x) => x.id!).filter((x) => x != null)] : []));
    update({ custom: c, spec: { ...spec, slides: filled.length ? filled : [[picks[0]]] } });
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

  const applied: TemplateOptions = { ...(custom ? { spec: clean } : {}), sv, pal };
  const extra = templateParams(applied).toString();
  const q = picks.join(",");
  const query = `picks=${q}${extra ? `&${extra}` : ""}`;
  const demo = isDemo(mode);
  const next = stepUrl(mode, "write", query);

  const shareUrl = () => `${window.location.origin}${stepUrl(mode, "design", query)}`;

  const standard = planSlides(items, { newsletter });
  const fit = channels ? <SlideFit channels={channels} slideCount={custom ? slideCount + 2 : standard.length} /> : null;
  // The sidebar: the brand, then which networks take all the slides. (Below the slides on a phone.)
  const side = (
    <div className="grid gap-6">
      <BrandPanel brand={brand} demo={isDemo(mode)} />
      {fit}
    </div>
  );
  return (
    // The step stays behind the loading animation until every slide preview has been drawn, so a refresh never shows frames that look like lost slides.
    <SlidesReadyGate layoutKnown={layoutKnown}>
      <div>
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:gap-x-4">
          <h1 className="mb-3 col-span-2 row-start-2 min-w-0 text-3xl sm:col-span-1 sm:col-start-1 sm:row-start-1 sm:text-5xl">
              <StepWord>Design</StepWord> your carousel
            </h1>
          <p className="col-span-2 row-start-3 mb-0 max-w-2xl text-lg sm:col-span-1 sm:col-start-1 sm:row-start-2">
            Use the standard layout, or build your own slides.
          </p>
          <div className="relative flex shrink-0 items-center gap-3 col-span-2 row-start-1 mb-2 justify-self-end sm:col-span-1 sm:col-start-2 sm:mb-0 sm:self-start sm:row-span-2 sm:mt-2">
              <SavedFlash />
              <ShareLinkButton
                getUrl={shareUrl}
                title={demo ? "Anyone with this link can open this demo, no account needed" : undefined}
              />
            </div>
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
          <p className="m-0 basis-full text-sm sm:flex-1 sm:basis-0">
            {custom
              ? "Drag picks into your own slides, and click any slide to edit its text."
              : "Pollen Picks' default layout and wording."}
          </p>
        </div>

        {custom ? (
          <SlideBuilder
            newsletter={newsletter}
            items={items}
            images={images}
            picks={q}
            mode={mode}
            spec={clean}
            styleVersion={sv}
            pal={pal}
            fit={side}
            onChange={setSpec}
          />
        ) : (
          // 70/30 on wide screens: the slides on the left, which networks take them on the right.
          <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
          <ol className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3">
            {standard.map((s, i) => (
              <li key={i} className="flex flex-col gap-2">
                <SlidePreview
                  src={`/api/slide/preview?picks=${q}&n=${i}${sv ? `&sv=${sv}` : ""}${pal ? `&pal=${pal}` : ""}${previewMode(mode)}&fmt=web&w=540`}
                  alt={`Slide ${i + 1} of ${standard.length}`}
                  hold={!layoutKnown}
                  eager={i < 5}
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
          <div className="lg:sticky lg:top-4">{side}</div>
          </div>
        )}

        <RunAutosave source={mode} picks={picks} template={extra} step={3} enabled={!demo && picks.length > 0 && extra.length <= SPEC_WARN} />
        <FlowBar
          next={custom && (placed === 0 || extra.length > SPEC_WARN) ? null : { href: next }}
          back={{ href: stepUrl(mode, "pick"), label: "Pick" }}
          status={
            <>
              <span className="sm:hidden">
                {custom
                  ? extra.length > SPEC_WARN
                    ? "Trim some text"
                    : placed === 0
                      ? "Place a pick"
                      : `${placed}/${picks.length} placed`
                  : `${standard.length} slides`}
              </span>
              <span className="hidden sm:inline">
                {custom
                  ? extra.length > SPEC_WARN
                    ? "Heavy customization: trim some text"
                    : placed === 0
                      ? "Drag at least one pick onto a slide"
                      : `${slideCount + 2} slides · ${placed} of ${picks.length} picks placed`
                  : `${standard.length} slides · ${picks.length} ${picks.length === 1 ? "pick" : "picks"}`}
              </span>
            </>
          }
        >
          {!demo && <SaveCreationButton source={mode} picks={picks} template={extra} step={3} />}
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
    </SlidesReadyGate>
  );
}

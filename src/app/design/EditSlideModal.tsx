"use client";

import { ArrowUpRight, Camera, Check, Flower2, ImagePlus, Link2, Loader2, Newspaper, Palette, User, X, type LucideIcon } from "lucide-react";
import { SourceLink } from "./SourceLink";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  SPEC_LIMITS,
  templateParams,
  type CustomSpec,
  type PickEdit,
} from "@/lib/slides/options";
import { sized } from "@/lib/cdn";
import type { IssueImage } from "@/lib/pollen/imageIds";
import { cleanHandle } from "@/lib/pollen/url";
import { MAX_PHOTO_LINKS, PHOTO_MAX_PICKS, type SlideItem } from "@/lib/slides/types";
import { oneLineLimit } from "@/lib/slides/plan";
import { usePalette } from "@/components/usePalette";
import { DEFAULT_COLORS, sameColor } from "@/lib/brand";
import { textOn } from "@/app/settings/PaletteEditor";
import { isDemo, previewMode } from "@/lib/flow";
import { STOCK_IMAGES } from "@/lib/slides/stock";
import { useSavedPhotos, type LinksApi } from "./photoLinks";
import { SlidePreview } from "./SlidePreview";
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
  sv?: string,
  width = 540,
): string {
  const p = templateParams({ spec, sv });
  return `/api/slide/preview?picks=${picks}&n=${previewIndex(spec, target)}&${p.toString()}${previewMode(mode)}&fmt=web&w=${width}`;
}

const input =
  "rounded-xl bg-surface px-3 py-2 font-normal text-ink ring-1 ring-ink/15";

/** Edit the text of one slide. The header and footer belong to the template and aren't editable. */
export function EditSlideModal({
  newsletter,
  target,
  spec,
  items,
  images,
  picks,
  mode,
  styleVersion,
  placed,
  onSave,
  onClose,
}: {
  newsletter: string;
  target: Target;
  spec: CustomSpec;
  items: SlideItem[];
  /** Pictures found in the issue. Undefined: this source has none to offer (no picker); empty: the issue has none (a note). */
  images?: IssueImage[];
  picks: string;
  mode?: string;
  styleVersion?: string;
  placed: number;
  onSave: (s: CustomSpec) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<CustomSpec>(() => structuredClone(spec));
  // Picks whose photo credit field was opened by hand (it is also shown whenever a credit is set).
  const [creditOpen, setCreditOpen] = useState<number[]>([]);
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
      for (const [k, v] of Object.entries(o ?? {})) {
        if (v === undefined) continue;
        // Text a person emptied on purpose stays empty ("leave it off the slide"); only text equal to the default is dropped.
        if (k in dflt) {
          if (v.trim() !== dflt[k]) out[k] = v;
        } else if (v && v.trim()) out[k] = v;
      }
      if (!out.photo) delete out.photoMode;
      return Object.keys(out).length ? out : undefined;
    };
    const edits: Record<number, PickEdit> = {};
    for (const [key, e] of Object.entries(d.edits ?? {})) {
      const base = byId.get(Number(key));
      const out: PickEdit = {};
      for (const k of Object.keys(e) as (keyof PickEdit)[]) {
        const v = e[k];
        if (v === undefined) continue;
        const original = k === "title" ? base?.title : k === "photoCredit" ? "" : (base?.[k] ?? "");
        if (k === "tag") {
          // Typed by hand: only a real handle counts. Emptied on purpose it stays empty, which removes the one found in the pick's link.
          const handle = v === "" ? "" : cleanHandle(v);
          if (handle === null || handle === original) continue;
          out[k] = handle;
          continue;
        }
        if (v === original) continue;
        out[k] = v;
      }
      if (Object.keys(out).length) edits[Number(key)] = out;
    }
    const { puff, noPhoto, ...coverText } = d.cover ?? {};
    const cover = pick(coverText, {
      title: DEFAULTS.coverTitle,
      subtitle: coverDefaultSub,
    });
    return {
      ...d,
      cover: cover || puff || noPhoto ? { ...cover, ...(puff ? { puff: true } : {}), ...(noPhoto && !cover?.photo ? { noPhoto: true } : {}) } : undefined,
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
  // Pictures on the pages the picks link to: only for the user's own issues (`images` is set), and only on slides that have room for one.
  const link = useLinkImages(mode, ids, !!images && ids.length <= PHOTO_MAX_PICKS);
  // Picture links the user saved: for anyone signed in on one of their own sources (the public demo can't keep them).
  const savedOn = !!mode && !isDemo(mode);
  const saved = useSavedPhotos(savedOn);
  /** Choosing a picture from a pick's link fills in who to credit (the pick's @handle, else the site's name); any other choice starts without a credit. It can be edited or cleared. */
  const choosePhoto = (id: number, photoId: string) => {
    if (photoId === value(id, "photo")) return;
    setEdit(id, "photo", photoId);
    const fromLink = !!photoId && (link.images[id] ?? []).some((i) => i.id === photoId) && !(images ?? []).some((i) => i.id === photoId);
    setEdit(id, "photoCredit", fromLink ? (byId.get(id)?.tag ? `@${byId.get(id)!.tag}` : (link.sites[id] ?? "")) : "");
  };

  const setCover = (k: "title" | "subtitle", v: string) =>
    setDraft((d) => ({ ...d, cover: { ...d.cover, [k]: v } }));
  // The cover starts with the issue's own preview image as its background (when it has one). Choosing "None" is remembered as noPhoto.
  const defaultCoverId = images?.find((i) => i.preview)?.id;
  const coverPhoto = draft.cover?.photo ?? (draft.cover?.noPhoto ? "" : (defaultCoverId ?? ""));
  const coverMode = draft.cover?.photo ? (draft.cover.photoMode ?? "section") : "background";
  const setCoverPhoto = (v: string) =>
    setDraft((d) => {
      const wasDefault = !d.cover?.photo && !d.cover?.noPhoto && !!defaultCoverId;
      return {
        ...d,
        cover: { ...d.cover, photo: v || undefined, noPhoto: v ? undefined : defaultCoverId ? true : undefined, photoMode: v ? (d.cover?.photo ? (d.cover.photoMode ?? "section") : wasDefault ? "background" : "section") : undefined },
      };
    });
  const setCoverPuff = (on: boolean) => setDraft((d) => ({ ...d, cover: { ...d.cover, puff: on || undefined } }));
  const setCoverPhotoMode = (m: "section" | "background") => setDraft((d) => ({ ...d, cover: { ...d.cover, photo: coverPhoto || undefined, noPhoto: undefined, photoMode: m } }));
  const setClosing = (k: "title" | "line" | "cta", v: string) =>
    setDraft((d) => ({ ...d, closing: { ...d.closing, [k]: v } }));
  // The closing slide has no picture until one is chosen (unlike the cover, which starts with the issue's own).
  const closingPhoto = draft.closing?.photo ?? "";
  const closingMode = draft.closing?.photoMode ?? "section";
  const setClosingPhoto = (v: string) =>
    setDraft((d) => ({ ...d, closing: { ...d.closing, photo: v || undefined, photoMode: v ? (d.closing?.photoMode ?? "section") : undefined } }));
  const setClosingPhotoMode = (m: "section" | "background") => setDraft((d) => ({ ...d, closing: { ...d.closing, photoMode: m } }));
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
    (key === "title" ? byId.get(id)?.title : key === "photoCredit" ? "" : byId.get(id)?.[key]) ??
    "";

  const groups = ids.map((id) => value(id, "group"));
  const mixedGroups = groups.some((g) => g !== groups[0]);
  const sharedGroup = mixedGroups ? "" : (groups[0] ?? "");
  /** One label for the whole slide: it becomes each pick's own category label, so it stays with the pick. */
  const setSlideGroup = (v: string) =>
    setDraft((d) => {
      const edits = { ...d.edits };
      for (const id of ids) edits[id] = { ...edits[id], group: v };
      return { ...d, edits };
    });

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
            <SlidePreview src={previewSrc(picks, normalize(settled), target, mode, styleVersion)} alt="Slide preview" />
            <div role="group" aria-labelledby="bg-heading" className="grid gap-2">
              <div className="flex items-center gap-1.5">
                <span id="bg-heading" className="text-sm font-semibold">
                  {target.kind === "slide" ? "Slide background" : "Background"}
                </span>
                <a
                  href="/settings?section=colors"
                  target="_blank"
                  rel="noreferrer"
                  title="Edit your palette in settings"
                  aria-label="Edit your palette in settings (opens in a new tab)"
                  className="grid size-6 place-items-center rounded-full hover:bg-ink/10"
                >
                  <ArrowUpRight aria-hidden className="size-4" strokeWidth={2.5} />
                </a>
              </div>
              <Swatches
                palette={palette}
                value={currentBg}
                fallback={defaultBg}
                onPick={setBg}
                label="Background"
                size="sm"
              />
            </div>

            {target.kind === "slide" && ids.length > 0 && (
              <label className="grid gap-1 text-sm font-semibold">
                Slide category label
                <input
                  value={sharedGroup}
                  maxLength={SPEC_LIMITS.group}
                  placeholder={mixedGroups ? "Mixed" : "None"}
                  aria-describedby="slide-group-hint"
                  onChange={(e) => setSlideGroup(e.target.value)}
                  className={input}
                />
                <span id="slide-group-hint" className="text-xs font-normal">
                  Fills in the category label of every pick on this slide. Each pick keeps its label if you move it.
                </span>
              </label>
            )}
            {target.kind === "slide" && ids.some((id) => value(id, "tag")) && (
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
                  Shows @handle on this slide&rsquo;s picks that have an Instagram tag. The caption keeps the tags either way.
                </p>
              </div>
            )}
          </div>
          <div className="grid content-start gap-5">
            <p className="m-0 text-sm">
              The header and footer are part of the template. Everything else on
              the slide is yours to change. Empty a field to leave it off: the
              rest of the slide uses the room.
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
                  <textarea
                    rows={2}
                    value={draft.cover?.subtitle ?? coverDefaultSub}
                    maxLength={SPEC_LIMITS.coverSubtitle}
                    onChange={(e) => setCover("subtitle", e.target.value)}
                    className={input}
                  />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
                  <input type="checkbox" checked={!!draft.cover?.puff} onChange={(e) => setCoverPuff(e.target.checked)} className="size-5 shrink-0 accent-ink" />
                  Dandelion in the top right corner
                </label>
                {/* The issue's pictures first, then the built-in ones, which are always there (an issue may have none). */}
                {(
                  <>
                    <PhotoPicker images={images ?? []} builtIn={STOCK_IMAGES} saved={savedOn ? saved : undefined} note={savedOn ? undefined : DEMO_PICTURES_NOTE} value={coverPhoto} onPick={setCoverPhoto} label="Cover picture" />
                    {coverPhoto && <PhotoModeChoice name="cover-photo-mode" value={coverMode} onChange={setCoverPhotoMode} />}
                  </>
                )}
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
                <PhotoPicker images={images ?? []} builtIn={STOCK_IMAGES} saved={savedOn ? saved : undefined} note={savedOn ? undefined : DEMO_PICTURES_NOTE} value={closingPhoto} onPick={setClosingPhoto} label="Closing picture" />
                {closingPhoto && <PhotoModeChoice name="closing-photo-mode" value={closingMode} onChange={setClosingPhotoMode} />}
              </>
            )}

            {target.kind === "slide" && (images || savedOn) && ids.length > 0 && (
              <p className="m-0 text-sm" role="note">
                {images && images.length === 0 && ids.length <= PHOTO_MAX_PICKS && !link.loading && ids.every((id) => !link.images[id]?.length)
                  ? "No pictures were found in this issue or on the pages its picks link to. You can add a link to your own."
                  : ids.length > PHOTO_MAX_PICKS
                    ? `Pictures fit on slides with up to ${PHOTO_MAX_PICKS} picks. Move a pick to a slide of its own to add one.`
                    : ids.length === PHOTO_MAX_PICKS
                      ? "Pictures take room on the card, so a long description may be shortened."
                      : null}
              </p>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1">
                      <h3 className="m-0 text-2xl">Pick {i + 1}</h3>
                      <SourceLink url={byId.get(id)?.url} title={value(id, "title") || `pick ${i + 1}`} size="size-8" />
                    </div>
                    <CardColor
                      palette={palette}
                      value={draft.edits?.[id]?.bg}
                      fallback={i % 2 === 0 ? DEFAULT_COLORS.card : DEFAULT_COLORS.accent}
                      onPick={(v) => setEdit(id, "bg", v)}
                      label={`Card color for pick ${i + 1}`}
                    />
                  </div>
                  <label className="grid gap-1 text-sm font-semibold">
                    Title
                    <input
                      value={value(id, "title")}
                      maxLength={SPEC_LIMITS.title}
                      onChange={(e) => setEdit(id, "title", e.target.value)}
                      className={input}
                    />
                  </label>
                  {ids.length <= PHOTO_MAX_PICKS && (
                    <PhotoPicker
                      images={images ?? []}
                      linkImages={link.images[id] ?? []}
                      builtIn={STOCK_IMAGES}
                      saved={savedOn ? saved : undefined}
                      loadingLink={link.loading}
                      issueLast
                      note={savedOn ? undefined : DEMO_PICTURES_NOTE}
                      value={value(id, "photo")}
                      onPick={(v) => choosePhoto(id, v)}
                      label={`Picture for pick ${i + 1}`}
                    />
                  )}
                  {value(id, "photo") && ids.length <= PHOTO_MAX_PICKS &&
                    (value(id, "photoCredit") || creditOpen.includes(id) ? (
                      <label className="grid gap-1 text-sm font-semibold">
                        Photo credit
                        <input
                          value={value(id, "photoCredit")}
                          maxLength={SPEC_LIMITS.photoCredit}
                          placeholder="@handle or site name (empty for no credit)"
                          autoFocus={creditOpen.includes(id) && !value(id, "photoCredit")}
                          onChange={(e) => setEdit(id, "photoCredit", e.target.value)}
                          className={input}
                        />
                        <span className="mt-1 text-xs font-normal">Goes in the caption (&ldquo;📷 Photos: …&rdquo;), not on the slide. Short captions for X, Bluesky, Threads and Mastodon leave it out.</span>
                      </label>
                    ) : (
                      <button type="button" onClick={() => setCreditOpen((o) => [...o, id])} className="inline-flex items-center gap-1.5 justify-self-start rounded-lg px-1 py-0.5 text-sm font-bold underline underline-offset-4">
                        <Camera aria-hidden className="size-4" strokeWidth={2.25} />
                        Add photo credit
                      </button>
                    ))}
                  <label className="grid gap-1 text-sm font-semibold">
                    Category label
                    <input
                      value={value(id, "group")}
                      maxLength={SPEC_LIMITS.group}
                      placeholder="None"
                      onChange={(e) => setEdit(id, "group", e.target.value)}
                      className={input}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Instagram tag
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="text-lg font-bold">
                        @
                      </span>
                      <input
                        value={value(id, "tag")}
                        maxLength={100}
                        placeholder="None"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-invalid={Boolean(value(id, "tag")) && !cleanHandle(value(id, "tag"))}
                        aria-describedby={`tag-hint-${id}`}
                        onChange={(e) => setEdit(id, "tag", e.target.value.replace(/\s/g, "").replace(/^@+/, ""))}
                        // A pasted profile link becomes its handle once you leave the field.
                        onBlur={(e) => {
                          const h = cleanHandle(e.target.value);
                          if (h && h !== e.target.value) setEdit(id, "tag", h);
                        }}
                        className={`${input} min-w-0 flex-1`}
                      />
                    </span>
                    {value(id, "tag") && !cleanHandle(value(id, "tag")) ? (
                      <span id={`tag-hint-${id}`} role="alert" className="mt-1 text-xs font-bold">
                        That isn&rsquo;t an Instagram handle. Use letters, numbers, periods and underscores (up to 30), or paste the profile link. It is left out until it is.
                      </span>
                    ) : (
                      <span id={`tag-hint-${id}`} className="mt-1 text-xs font-normal">
                        Shown on this pick&rsquo;s card and added to the Instagram caption as @handle after the title.
                        {byId.get(id)?.tag ? ` Found in the link: @${byId.get(id)!.tag}. Clear the field to leave it out.` : ""}
                      </span>
                    )}
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
        {/* On a phone the status takes a row of its own, with Revert and Done below it; from sm up it is one row. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-7 sm:py-5">
          <div className="contents sm:flex sm:items-center sm:gap-4">
            <p
              role="status"
              className="m-0 text-sm font-semibold max-sm:basis-full"
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
            className="rounded-xl bg-ink px-6 py-3 font-bold text-cream hover:bg-ink-deep max-sm:ml-auto"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

type Source = "issue" | "link" | "builtin" | "saved";
/** Where a picture came from: the icon on its tile, the word in the legend, and how a screen reader hears it. */
const SOURCE: Record<Source, { icon: LucideIcon; short: string; spoken: string }> = {
  issue: { icon: Newspaper, short: "Issue", spoken: "from the issue" },
  link: { icon: Link2, short: "Link", spoken: "from this pick's link" },
  builtin: { icon: Flower2, short: "Built in", spoken: "built in" },
  saved: { icon: User, short: "Yours", spoken: "a link you saved" },
};

/** One picture to choose from. A picture the browser can't load (a site that refuses to be shown elsewhere) is left out. */
function Thumb({ img, on, onPick, n, source, onRemove }: { img: IssueImage; on: boolean; onPick: () => void; n: number; source: Source; /** Saved links can be removed. */ onRemove?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const { icon: Icon, spoken } = SOURCE[source];
  const name = `${img.alt || `Picture ${n}`}, ${spoken}`;
  const tile = (
    <button type="button" onClick={onPick} aria-pressed={on} aria-label={name} title={name} className={`${TILE} ${on ? TILE_ON : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sized(img.src, 160)} alt="" width={64} height={64} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
      <span aria-hidden className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-ink/80 text-cream">
        <Icon className="size-3" strokeWidth={2.5} />
      </span>
    </button>
  );
  if (!onRemove) return tile;
  return (
    <span className="relative shrink-0">
      {tile}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${img.alt || `picture ${n}`}`}
        title="Remove this photo"
        className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-cream ring-2 ring-page hover:bg-ink-deep"
      >
        <X aria-hidden className="size-3" strokeWidth={3} />
      </button>
    </span>
  );
}

const TILE = "relative grid size-12 shrink-0 sm:size-16 place-items-center overflow-hidden rounded-lg text-xs font-bold ring-1 ring-current/30 hover:ring-current";
const TILE_ON = "ring-2 ring-current";

/** Where a cover or closing picture goes: a block between the logo and the text, or the whole slide behind them. */
function PhotoModeChoice({ name, value, onChange }: { name: string; value: "section" | "background"; onChange: (m: "section" | "background") => void }) {
  return (
    <div role="radiogroup" aria-label="Where the picture goes" className="flex flex-wrap gap-2">
      {(
        [
          ["section", "As a section"],
          ["background", "As the background"],
        ] as const
      ).map(([m, label]) => (
        <label
          key={m}
          className="cursor-pointer rounded-xl bg-surface px-4 py-2 text-sm font-bold ring-1 ring-ink/15 transition hover:ring-ink/40 has-[:checked]:bg-ink has-[:checked]:text-cream has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
        >
          <input type="radio" name={name} checked={value === m} onChange={() => onChange(m)} className="sr-only" />
          {label}
        </label>
      ))}
    </div>
  );
}

/**
 * The pictures to choose from, in one row: "None", then the issue's own, the ones found on the page the pick links to, and the
 * built-in ones. A small icon on each tile (and the legend above the row) says which is which. `value` is an image id; "" means none.
 */
function PhotoPicker({
  images,
  linkImages = [],
  builtIn = [],
  saved,
  loadingLink = false,
  issueLast = false,
  note,
  value,
  onPick,
  label,
}: {
  /** The issue's own pictures. */
  images: IssueImage[];
  /** Pictures found on the page the pick links to (none for the cover). */
  linkImages?: IssueImage[];
  /** Pictures that come with the app (the cover offers them). */
  builtIn?: IssueImage[];
  /** The user's own saved picture links, with adding and removing. Without it there is no "Add link" button. */
  saved?: LinksApi;
  loadingLink?: boolean;
  /** Slides list the issue's pictures last: the title slide has most likely used them already. The cover lists them first. */
  issueLast?: boolean;
  /** A line under the row (the demo says what signing in adds). */
  note?: string;
  value: string;
  onPick: (id: string) => void;
  label: string;
}) {
  // A picture the issue has is listed once, under the issue.
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState("");
  const all: [Source, IssueImage[]][] = [
    ["saved", saved?.images ?? []],
    ["issue", images],
    ["link", linkImages.filter((l) => !images.some((i) => i.id === l.id))],
    ["builtin", builtIn],
  ];
  if (issueLast) all.push(all.splice(1, 1)[0]);
  // While the pick's link is read, its place in the row (after "Yours", before the rest) holds a loading chip, so it is in view rather than past the end of the row.
  const groups = all.filter(([source, list]) => list.length > 0 || (source === "link" && loadingLink));
  return (
    <div role="group" aria-label={label} className="grid gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="text-sm font-semibold">Picture</span>
        {loadingLink && <span className="hidden text-xs font-normal sm:inline">Checking this pick&rsquo;s link…</span>}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto p-1">
        <button type="button" onClick={() => onPick("")} aria-pressed={!value} className={`${TILE} ${!value ? TILE_ON : ""}`}>
          None
        </button>
        {saved && (
          <button
            type="button"
            onClick={() => setAdding((o) => !o)}
            aria-expanded={adding}
            title="Add a link to a public picture"
            aria-label="Add a link to a public picture"
            className={`${TILE} border-2 border-dashed border-current/50 ring-0 ${adding ? "bg-current/10" : ""}`}
          >
            <ImagePlus aria-hidden className="size-6" strokeWidth={2.25} />
          </button>
        )}
        {groups.map(([source, list]) => (
          <Fragment key={source}>
            <span aria-hidden className="h-8 w-px shrink-0 bg-current/25 sm:h-10" />
            {source === "link" && loadingLink && (
              <span
                role="status"
                aria-label="Adding pictures from this pick's link"
                className="inline-flex h-12 shrink-0 animate-pulse items-center justify-center gap-1.5 rounded-lg bg-current/10 px-3 text-xs font-bold ring-1 ring-current/30 sm:size-16 sm:px-0"
              >
                <Loader2 aria-hidden className="size-4 animate-spin opacity-70 sm:hidden" />
                <Link2 aria-hidden className="hidden size-4 opacity-60 sm:block" />
                <span className="whitespace-nowrap sm:hidden">Adding from link…</span>
              </span>
            )}
            {list.map((img, n) => (
              <Thumb
                key={img.id}
                img={img}
                n={n + 1}
                source={source}
                on={value === img.id}
                onPick={() => onPick(img.id)}
                onRemove={
                  source === "saved" && saved
                    ? () => {
                        if (value === img.id) onPick("");
                        void saved.remove(img.id);
                      }
                    : undefined
                }
              />
            ))}
          </Fragment>
        ))}
      </div>
      {note && <p className="m-0 text-xs font-normal">{note}</p>}
      {saved && adding && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!link.trim() || saved.busy) return;
            const id = await saved.add(link);
            if (id) {
              onPick(id);
              setLink("");
              setAdding(false);
            }
          }}
        >
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://… link to a public picture"
            aria-label="Link to a public picture"
            autoFocus
            className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-sm font-normal text-ink ring-1 ring-ink/15"
          />
          <button type="submit" disabled={saved.busy || !link.trim()} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-cream disabled:opacity-50">
            {saved.busy ? "Checking…" : "Add"}
          </button>
        </form>
      )}
      {saved && adding && (
        <p className="m-0 text-xs font-normal">
          {saved.error && (
            <strong role="alert" className="block">
              {saved.error}
            </strong>
          )}
          Images must stay public and online.{" "}
          {saved.images.length >= MAX_PHOTO_LINKS - 10 && `${saved.images.length}/${MAX_PHOTO_LINKS} added to your account. `}
          <a href="/settings?section=photos" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">
            {saved.images.length >= MAX_PHOTO_LINKS - 10 ? "Manage in Settings" : "See all linked images in Settings"}
          </a>
        </p>
      )}
      {saved && !adding && saved.error && (
        <p role="alert" className="m-0 text-xs font-bold">
          {saved.error}
        </p>
      )}
    </div>
  );
}

/** The demo reads no links and keeps no uploads: it offers the built-in pictures and says what an account adds. */
const DEMO_PICTURES_NOTE = "Log in to fetch images from links and upload your own.";

// What the pages the picks link to had, kept for the visit so reopening a slide doesn't read the pages again.
type LinkData = { images: Record<number, IssueImage[]>; sites: Record<number, string> };
const linkCache = new Map<string, LinkData>();
const NO_LINKS: LinkData = { images: {}, sites: {} };

/** The pictures on the pages the given picks link to, and each page's site name (a credit suggestion). Empty while loading, and when nothing could be read. Only reads when `enabled`. */
function useLinkImages(mode: string | undefined, ids: number[], enabled: boolean): LinkData & { loading: boolean } {
  const key = `${mode ?? ""}|${ids.join(",")}`;
  const [got, setGot] = useState<{ key: string; data: LinkData } | null>(null);
  const active = enabled && !!mode && !isDemo(mode) && ids.length > 0;
  const cached = active ? linkCache.get(key) : undefined;
  useEffect(() => {
    if (!active || linkCache.has(key)) return;
    const ctrl = new AbortController();
    const p = new URLSearchParams({ mode: mode!, picks: ids.join(",") });
    fetch(`/api/pick/images?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Partial<LinkData>) => {
        const data = { images: d.images ?? {}, sites: d.sites ?? {} };
        linkCache.set(key, data);
        setGot({ key, data });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setGot({ key, data: NO_LINKS });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already covers mode and ids
  }, [key, active]);
  if (!active) return { ...NO_LINKS, loading: false };
  if (cached) return { ...cached, loading: false };
  return got?.key === key ? { ...got.data, loading: false } : { ...NO_LINKS, loading: true };
}

/** Default swatch plus the palette. `value` "" / undefined means default. */
export function Swatches({
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
  const firstMatch = palette.find((hex) => sameColor(hex, fallback));
  const hiddenDefault = firstMatch !== undefined;
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
    >
      {[
        // The default is only listed when no palette color is already that color (it would be a second, identical circle).
        ...(palette.some((hex) => sameColor(hex, fallback)) ? [] : [{ hex: "", label: "Default" }]),
        ...palette.map((hex) => ({ hex, label: hex })),
      ].map((o) => {
        const on = value
          ? value.toLowerCase() === o.hex
          : o.hex === "" || (hiddenDefault && sameColor(o.hex, fallback) && o.hex === firstMatch);
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

/** A card's color: one circle (its current color) that opens the palette. */
function CardColor({
  palette,
  value,
  fallback,
  onPick,
  label,
}: {
  palette: string[];
  value?: string;
  fallback: string;
  onPick: (hex: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const shown = value || fallback;
  return (
    <div
      ref={box}
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        title="Card color"
        style={{ background: shown }}
        className="grid size-9 place-items-center rounded-full ring-2 ring-current hover:opacity-80"
      >
        <Palette aria-hidden className="size-4" strokeWidth={2.25} style={{ color: textOn(shown) }} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-max max-w-[16rem] rounded-xl bg-page p-3 text-ink shadow-lg ring-1 ring-ink/15">
          <Swatches
            palette={palette}
            value={value}
            fallback={fallback}
            onPick={(v) => {
              onPick(v);
              setOpen(false);
            }}
            label={label}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

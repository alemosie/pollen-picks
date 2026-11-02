"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import {
  MAX_CUSTOM_SLIDES,
  MAX_PER_SLIDE,
  type CustomSpec,
} from "@/lib/slides/options";
import { planSlides } from "@/lib/slides/plan";
import type { SlideItem } from "@/lib/slides/types";
import { PickSelectModal } from "./PickSelectModal";
import { EditSlideModal, previewSrc, type Target } from "./EditSlideModal";
import { useSettled } from "./useSettled";

/** Lay out the carousel by hand: drag picks onto slides (up to 4 each), reorder, and click any slide to edit its text. */
export function SlideBuilder({
  items,
  picks,
  spec,
  onChange,
}: {
  items: SlideItem[];
  picks: string;
  spec: CustomSpec;
  onChange: (s: CustomSpec) => void;
}) {
  const [editing, setEditing] = useState<Target | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [full, setFull] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  // Shift-click picks on slides to select several, then remove them together (Delete key or the bar).
  const [sel, setSel] = useState<number[]>([]);
  // A subsection folds away once all of its picks are on slides; click its name to open or close it by hand.
  const [fold, setFold] = useState<Record<string, boolean>>({});
  const [anchor, setAnchor] = useState<{ si: number; pi: number } | null>(null);
  const [selecting, setSelecting] = useState<number | null>(null);
  const settled = useSettled(spec, 500);

  const byId = new Map(items.map((i) => [i.id!, i]));
  const placedAt = new Map<number, number>();
  spec.slides.forEach((g, si) => g.forEach((id) => placedAt.set(id, si)));
  const placed = placedAt.size;

  const edited = (id: number) =>
    spec.edits?.[id]?.title?.trim()
      ? spec.edits[id].title!
      : (byId.get(id)?.title ?? "");
  // Slide colors (`bgs`) are parallel to `slides`: operations that move or drop whole slides pass the matching colors along.
  const set = (slides: number[][], bgs?: string[]) =>
    onChange({
      ...spec,
      slides: slides.length ? slides : [[]],
      ...(bgs ? { bgs: slides.length ? bgs : [] } : {}),
    });

  /** Put pick `id` on slide `to` (before position `at`, default the end), taking it off wherever it was. */
  function place(id: number, to: number, at?: number) {
    const slides = spec.slides.map((g) => g.filter((x) => x !== id));
    if (slides[to].length >= MAX_PER_SLIDE) {
      setFull(to);
      setTimeout(() => setFull(null), 1800);
      return;
    }
    slides[to].splice(at ?? slides[to].length, 0, id);
    setActive(to);
    set(slides);
  }
  /** Tap-to-add: the active slide if it has room, else the first slide with room, else a new slide. */
  function quickAdd(id: number) {
    const slides = spec.slides.map((g) => g.filter((x) => x !== id));
    let to =
      slides[active] && slides[active].length < MAX_PER_SLIDE
        ? active
        : slides.findIndex((g) => g.length < MAX_PER_SLIDE);
    if (to === -1) {
      if (slides.length >= MAX_CUSTOM_SLIDES) return;
      slides.push([]);
      to = slides.length - 1;
    }
    slides[to].push(id);
    setActive(to);
    set(slides);
  }
  /** Replace slide `to` with exactly `ids`, moving them off any other slide. */
  function setSlide(to: number, ids: number[]) {
    const slides = spec.slides.map((g, k) =>
      k === to ? ids : g.filter((x) => !ids.includes(x)),
    );
    setActive(to);
    set(slides);
  }
  /** Put a whole subsection on slides: fills empty slides first, 4 per slide, moving the picks off wherever they were. */
  function addGroup(ids: number[]) {
    const slides = spec.slides.map((g) => g.filter((x) => !ids.includes(x)));
    let first = -1;
    for (let c = 0; c < ids.length; c += MAX_PER_SLIDE) {
      let to = slides.findIndex((g) => g.length === 0);
      if (to === -1) {
        if (slides.length >= MAX_CUSTOM_SLIDES) break;
        slides.push([]);
        to = slides.length - 1;
      }
      slides[to] = ids.slice(c, c + MAX_PER_SLIDE);
      if (first < 0) first = to;
    }
    if (first >= 0) setActive(first);
    set(slides);
  }
  /** Nudge a pick one place up or down within its slide. */
  const move = (si: number, pi: number, by: -1 | 1) => {
    const slides = spec.slides.map((g) => [...g]);
    const g = slides[si];
    const to = pi + by;
    if (to < 0 || to >= g.length) return;
    [g[pi], g[to]] = [g[to], g[pi]];
    set(slides);
  };
  const groupIds = new Map<string, number[]>();
  for (const it of items)
    if (it.group)
      groupIds.set(it.group, [...(groupIds.get(it.group) ?? []), it.id!]);
  const isCollapsed = (g: string) =>
    fold[g] ?? (groupIds.get(g) ?? []).every((id) => placedAt.has(id));
  const removeMany = (ids: number[]) => {
    set(spec.slides.map((g) => g.filter((x) => !ids.includes(x))));
    setSel([]);
    setAnchor(null);
  };
  const clickPick = (e: React.MouseEvent, si: number, pi: number) => {
    const id = spec.slides[si][pi];
    if (e.shiftKey && anchor && anchor.si === si) {
      const [a, b] = [Math.min(anchor.pi, pi), Math.max(anchor.pi, pi)];
      const range = spec.slides[si].slice(a, b + 1);
      setSel((s) => [...new Set([...s, ...range])]);
    } else if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
      setAnchor({ si, pi });
    } else if (sel.length) {
      setSel([]);
    }
    if (e.shiftKey) window.getSelection()?.removeAllRanges();
  };
  useEffect(() => {
    if (!sel.length) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, dialog")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeMany(sel);
      } else if (e.key === "Escape") setSel([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const remove = (id: number) =>
    set(spec.slides.map((g) => g.filter((x) => x !== id)));
  const addSlide = () => {
    if (spec.slides.length >= MAX_CUSTOM_SLIDES) return;
    set([...spec.slides, []]);
    setActive(spec.slides.length);
  };
  const moveSlide = (i: number, by: -1 | 1) => {
    const to = i + by;
    if (to < 0 || to >= spec.slides.length) return;
    const slides = [...spec.slides];
    [slides[i], slides[to]] = [slides[to], slides[i]];
    const bgs = slides.map((_, k) => spec.bgs?.[k] ?? "");
    [bgs[i], bgs[to]] = [bgs[to], bgs[i]];
    setActive(to);
    set(slides, bgs);
  };
  const deleteSlide = (i: number) =>
    set(
      spec.slides.filter((_, k) => k !== i),
      spec.slides.map((_, k) => spec.bgs?.[k] ?? "").filter((_, k) => k !== i),
    );
  const autoFill = () => {
    const planned = planSlides(items, { newsletter: "Just a Phase" }).filter(
      (s) => s.kind === "picks",
    );
    set(
      planned.map((s) =>
        s.kind === "picks"
          ? s.items.map((x) => x.id!).filter((x) => x != null)
          : [],
      ),
      planned.map(() => ""),
    );
  };

  const thumb = (t: Target, label: string, empty?: boolean) => (
    <button
      type="button"
      onClick={() => !empty && setEditing(t)}
      disabled={empty}
      aria-label={empty ? undefined : `Edit ${label}`}
      className="group relative aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-xl bg-surface ring-1 ring-ink/10 enabled:cursor-pointer enabled:hover:ring-2 enabled:hover:ring-ink sm:w-36"
    >
      {empty ? (
        <span className="grid h-full place-items-center border-2 border-dashed border-ink/20 p-3 text-center text-xs font-semibold text-ink/50">
          Blank
        </span>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc(picks, settled, t)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink/80 py-1 text-xs font-bold text-cream opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <Pencil aria-hidden className="size-3" /> Edit text
          </span>
        </>
      )}
    </button>
  );

  const fixed = (t: Target, name: string, hint: string) => (
    <div className="flex items-center gap-4 rounded-2xl bg-surface p-3 ring-1 ring-ink/10">
      {thumb(t, name)}
      <div className="min-w-0">
        <p className="m-0 font-bold">{name}</p>
        <p className="m-0 text-sm">{hint}</p>
      </div>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-2xl">Slides</h2>
          <div className="flex gap-4 text-sm font-semibold">
            <button
              type="button"
              onClick={autoFill}
              className="underline underline-offset-4"
            >
              Fill from standard layout
            </button>
            {placed > 0 && (
              <button
                type="button"
                onClick={() =>
                  onChange({ ...spec, slides: [[]], bgs: undefined })
                }
                className="underline underline-offset-4"
              >
                Clear slides
              </button>
            )}
          </div>
        </div>

        {sel.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-cream">
            <span>{sel.length} selected</span>
            <span className="flex gap-4">
              <button
                type="button"
                onClick={() => removeMany(sel)}
                className="inline-flex items-center gap-1.5 font-bold underline underline-offset-4"
              >
                <Trash2 aria-hidden className="size-4" /> Remove{" "}
                {sel.length === 1 ? "pick" : "picks"}
              </button>
              <button
                type="button"
                onClick={() => setSel([])}
                className="underline underline-offset-4"
              >
                Clear selection
              </button>
            </span>
          </div>
        ) : (
          placed > 1 && (
            <p className="m-0 hidden text-sm lg:block">
              Tip: shift-click picks on a slide to select several, then press
              Delete.
            </p>
          )
        )}

        {fixed(
          { kind: "cover" },
          "Cover",
          "Click to edit the title and subtitle.",
        )}

        {spec.slides.map((ids, si) => {
          const isOver = over === si;
          return (
            <div
              key={si}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(si);
              }}
              onDragLeave={() => setOver((o) => (o === si ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isFinite(id)) place(id, si);
                setDragId(null);
              }}
              onClick={() => setActive(si)}
              className={`flex gap-4 rounded-2xl bg-surface p-3 ring-1 transition ${isOver ? "ring-2 ring-coral" : active === si ? "ring-ink/40" : "ring-ink/10"}`}
            >
              {thumb(
                { kind: "slide", index: si },
                `slide ${si + 1}`,
                ids.length === 0,
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="m-0 font-bold">
                    Slide {si + 1}{" "}
                    <span className="font-normal text-ink/70">
                      · {ids.length} of {MAX_PER_SLIDE}
                    </span>
                  </p>
                  {spec.slides.length > 1 && (
                    <div className="flex items-center">
                      {([-1, 1] as const).map((by) => (
                        <button
                          key={by}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSlide(si, by);
                          }}
                          disabled={
                            si + by < 0 || si + by >= spec.slides.length
                          }
                          aria-label={`Move slide ${si + 1} ${by < 0 ? "up" : "down"}`}
                          className="grid size-8 place-items-center rounded-full hover:bg-ink/10 disabled:opacity-25 disabled:hover:bg-transparent"
                        >
                          {by < 0 ? (
                            <ChevronUp aria-hidden className="size-4" />
                          ) : (
                            <ChevronDown aria-hidden className="size-4" />
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => deleteSlide(si)}
                        aria-label={`Delete slide ${si + 1}`}
                        className="grid size-8 place-items-center rounded-full hover:bg-ink/10"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
                {full === si && (
                  <p className="m-0 mb-2 text-sm font-semibold text-coral">
                    A slide holds up to {MAX_PER_SLIDE} picks.
                  </p>
                )}
                {ids.length === 0 ? (
                  <>
                    <p className="m-0 hidden rounded-xl border-2 border-dashed border-ink/20 p-4 text-sm lg:block">
                      Drag picks here, or tap + next to a pick.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelecting(si);
                      }}
                      className="w-full rounded-xl border-2 border-dashed border-ink/30 p-4 text-sm font-bold hover:bg-ink/5 lg:hidden"
                    >
                      Tap here to select picks
                    </button>
                  </>
                ) : (
                  <ul className="m-0 grid list-none gap-1.5 p-0">
                    {ids.map((id, pi) => (
                      <li
                        key={id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", String(id));
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOver(null);
                          const d = Number(
                            e.dataTransfer.getData("text/plain"),
                          );
                          if (Number.isFinite(d) && d !== id) place(d, si, pi);
                          setDragId(null);
                        }}
                        onClick={(e) => clickPick(e, si, pi)}
                        className={`flex cursor-grab select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold ${sel.includes(id) ? "bg-surface ring-2 ring-ink" : "bg-card"} ${dragId === id ? "opacity-40" : ""}`}
                      >
                        {sel.includes(id) ? (
                          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-ink text-cream">
                            <Check
                              aria-hidden
                              className="size-3"
                              strokeWidth={3.5}
                            />
                          </span>
                        ) : (
                          <GripVertical
                            aria-hidden
                            className="size-4 shrink-0 opacity-50"
                          />
                        )}
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={edited(id)}
                        >
                          {edited(id)}
                        </span>
                        {ids.length > 1 && (
                          <span className="flex shrink-0">
                            {([-1, 1] as const).map((by) => (
                              <button
                                key={by}
                                type="button"
                                onClick={() => move(si, pi, by)}
                                disabled={pi + by < 0 || pi + by >= ids.length}
                                aria-label={`Move ${edited(id)} ${by < 0 ? "up" : "down"}`}
                                className={`grid size-6 place-items-center rounded-full disabled:opacity-25 disabled:hover:bg-transparent hover:bg-ink/10`}
                              >
                                {by < 0 ? (
                                  <ChevronUp aria-hidden className="size-4" />
                                ) : (
                                  <ChevronDown aria-hidden className="size-4" />
                                )}
                              </button>
                            ))}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(id)}
                          aria-label={`Remove ${edited(id)} from slide ${si + 1}`}
                          className={`grid size-6 shrink-0 place-items-center rounded-full hover:bg-ink/10`}
                        >
                          <X aria-hidden className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addSlide}
          disabled={spec.slides.length >= MAX_CUSTOM_SLIDES}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/25 py-3 font-bold hover:bg-ink/5 disabled:opacity-40"
        >
          <Plus aria-hidden className="size-4" /> Add a slide
        </button>

        {fixed(
          { kind: "closing" },
          "Closing slide",
          "Click to edit the title, line and button.",
        )}
      </div>

      <aside className="flex min-h-0 flex-col rounded-2xl bg-card pt-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)]">
        <h2 className="mb-1 px-5 text-2xl">
          Your picks ({picks.split(",").filter(Boolean).length})
        </h2>
        <p className="mb-3 mt-0 px-5 text-sm">
          Drag a pick onto a slide, or tap + to add it to the highlighted slide.
        </p>
        <ul className="m-0 grid min-h-0 list-none content-start gap-1.5 overflow-y-auto p-0 pb-5 pl-5 pr-3 pt-1 [scrollbar-color:rgba(43,58,54,0.3)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-ink/30 [&::-webkit-scrollbar-track]:bg-transparent">
          {items.map((it, i) => {
            const at = placedAt.get(it.id!);
            const heading =
              it.group && it.group !== items[i - 1]?.group ? it.group : null;
            const gids: number[] = [];
            if (heading)
              for (
                let k = i;
                k < items.length && items[k].group === it.group;
                k++
              )
                gids.push(items[k].id!);
            const hide = !!it.group && isCollapsed(it.group);
            return (
              <Fragment key={it.id}>
                {heading && (
                  <li
                    className={`flex list-none items-center justify-between gap-2 ${i > 0 ? "mt-3" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setFold((f) => ({ ...f, [heading]: !hide }))
                      }
                      aria-expanded={!hide}
                      className={`inline-flex min-w-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-3 text-xs font-bold ring-1 ${gids.every((id) => placedAt.has(id)) ? "bg-ink/10 ring-ink/30" : gids.some((id) => placedAt.has(id)) ? "bg-surface ring-ink/25" : "bg-surface ring-ink/15"}`}
                    >
                      <ChevronDown
                        aria-hidden
                        className={`size-3.5 shrink-0 transition-transform ${hide ? "-rotate-90" : ""}`}
                        strokeWidth={3}
                      />
                      <span className="truncate">
                        {heading} · {gids.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        gids.every((id) => placedAt.has(id))
                          ? set(
                              spec.slides.map((g) =>
                                g.filter((x) => !gids.includes(x)),
                              ),
                            )
                          : addGroup(gids)
                      }
                      title="Put this whole section on slides, 4 per slide"
                      className="shrink-0 px-1 text-xs font-bold underline underline-offset-4"
                    >
                      {gids.every((id) => placedAt.has(id))
                        ? "Clear"
                        : "Select all"}
                    </button>
                  </li>
                )}
                {!hide && (
                  <li
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(it.id));
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(it.id!);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={`flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold ${at != null ? "bg-surface/50 text-ink/70 ring-1 ring-ink/10" : "bg-surface ring-1 ring-ink/10"} ${dragId === it.id ? "opacity-40" : ""}`}
                  >
                    <GripVertical
                      aria-hidden
                      className="size-4 shrink-0 opacity-50"
                    />
                    <span
                      className="line-clamp-2 min-w-0 flex-1"
                      title={edited(it.id!)}
                    >
                      {edited(it.id!)}
                    </span>
                    {at != null ? (
                      <button
                        type="button"
                        onClick={() => remove(it.id!)}
                        title={`On slide ${at + 1} · click to remove`}
                        aria-label={`Remove ${edited(it.id!)} from slide ${at + 1}`}
                        className="group/badge grid size-6 shrink-0 place-items-center rounded-full bg-ink/15 text-xs font-bold text-ink hover:bg-ink hover:text-cream focus-visible:bg-ink focus-visible:text-cream"
                      >
                        <span className="group-hover/badge:hidden group-focus-visible/badge:hidden">
                          {at + 1}
                        </span>
                        <X
                          aria-hidden
                          strokeWidth={3}
                          className="hidden size-3.5 group-hover/badge:block group-focus-visible/badge:block"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => quickAdd(it.id!)}
                        aria-label={`Add ${edited(it.id!)} to a slide`}
                        className="grid size-6 shrink-0 place-items-center rounded-full bg-ink/10 hover:bg-ink/20"
                      >
                        <Plus aria-hidden className="size-4" />
                      </button>
                    )}
                  </li>
                )}
              </Fragment>
            );
          })}
        </ul>
      </aside>

      {selecting != null && (
        <PickSelectModal
          key={selecting}
          slideNumber={selecting + 1}
          options={items.map((it) => ({
            id: it.id!,
            title: edited(it.id!),
            group: it.group,
            at: placedAt.get(it.id!),
          }))}
          initial={spec.slides[selecting] ?? []}
          onDone={(ids) => setSlide(selecting, ids)}
          onClose={() => setSelecting(null)}
        />
      )}

      {editing && (
        <EditSlideModal
          key={JSON.stringify(editing)}
          target={editing}
          spec={spec}
          items={items}
          picks={picks}
          placed={placed}
          onSave={onChange}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

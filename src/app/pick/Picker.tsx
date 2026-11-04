"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadPicked, savePicked } from "@/lib/progress";
import Link from "next/link";
import { Select } from "@/components/Select";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { stepUrl } from "@/lib/flow";
import {
  AlignLeft,
  LayoutList,
  Link2,
  List,
  Highlighter,
  MousePointerClick,
  X,
  type LucideIcon,
} from "lucide-react";
import { isCustomId } from "@/lib/pollen/custom";
import { ManualPane } from "./ManualPane";
import type { View } from "./picking";

type Chunk = {
  id: number;
  section: string;
  group?: string;
  topic?: string;
  kind: "bullet" | "paragraph";
  title: string;
  body: string;
  text: string;
  when: string | null;
  place: string | null;
  blurb: string;
  url: string | null;
  rank: number | null;
  score: number | null;
};

/** What kind of element a card is, shown as a small icon in its corner: a link, a list item or a paragraph. */
function elementType(c: Pick<Chunk, "id" | "kind" | "url">): {
  icon: LucideIcon;
  label: string;
} {
  if (isCustomId(c.id)) return { icon: Highlighter, label: "Highlight" };
  if (c.url) return { icon: Link2, label: "Link" };
  if (c.kind === "bullet") return { icon: List, label: "List item" };
  return { icon: AlignLeft, label: "Paragraph" };
}

const MAX = 20;
const topIdsOf = (chunks: { id: number; rank: number | null }[], n: number) =>
  chunks
    .filter((c) => c.rank && c.rank <= n)
    .sort((a, b) => a.rank! - b.rank!)
    .map((c) => c.id);
/** Each pick type has its own brand accent: the selected tab, the panel outline and picked cards share it. */
const ACCENT: Record<View, { solid: string; light: string; border: string }> = {
  "top-clicks": {
    solid: "bg-honey",
    light: "bg-honey/20 hover:bg-honey/40",
    border: "border-honey",
  },
  section: {
    solid: "bg-sage",
    light: "bg-sage/20 hover:bg-sage/40",
    border: "border-sage",
  },
  manual: {
    solid: "bg-blush",
    light: "bg-blush/30 hover:bg-blush/60",
    border: "border-blush",
  },
};

export function Picker({
  mode,
  chunks: serverChunks,
  hasClicks,
  initialView,
  initialPicks,
  manual = false,
  manualOnly = false,
}: {
  mode: string;
  chunks: Chunk[];
  hasClicks: boolean;
  initialView?: View;
  initialPicks?: number[];
  /** Show the Manual tab (highlight text in the issue as published). Only for the user's own issues. */
  manual?: boolean;
  /** Only the Manual tab: the page is one the visitor pasted, so there is nothing parsed to browse. */
  manualOnly?: boolean;
}) {
  // Highlights saved or removed in the Manual tab this visit; the server's list covers earlier visits.
  const [extra, setExtra] = useState<Chunk[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const chunks = useMemo(() => {
    const have = new Set(serverChunks.map((c) => c.id));
    return [...serverChunks, ...extra.filter((c) => !have.has(c.id))].filter(
      (c) => !removed.includes(c.id),
    );
  }, [serverChunks, extra, removed]);
  const parsed = serverChunks.some((c) => !isCustomId(c.id));
  const [view, setViewState] = useState<View>(
    manualOnly
      ? "manual"
      : initialView === "manual" && !manual
      ? "section"
      : initialView === "top-clicks" && !hasClicks
        ? "section"
        : (initialView ??
          (hasClicks
            ? "top-clicks"
            : manual && !parsed
              ? "manual"
              : "section")),
  );
  // Keep ?picking= in the address bar so the pick type is linkable and survives reloads.
  const setView = (v: View) => {
    setViewState(v);
    const url = new URL(window.location.href);
    url.searchParams.set("picking", v);
    window.history.replaceState(null, "", url);
  };
  const sections = useMemo(
    () => [...new Set(chunks.map((c) => c.section))],
    [chunks],
  );
  // Default to the section with the most ranked items (the activity list).
  const [section, setSection] = useState(() => {
    const counts = new Map<string, number>();
    for (const c of chunks)
      if (c.rank) counts.set(c.section, (counts.get(c.section) ?? 0) + 1);
    return (
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? sections[0]
    );
  });
  // Nothing is picked until the user picks it (the Top 3/5/10 chips are there for a quick start).
  const [picked, setPicked] = useState<number[]>([]);
  // Remember the selection so leaving and coming back doesn't lose it. Restore after mount (keeps SSR markup identical).
  const [restored, setRestored] = useState(false);
  const restoredOnce = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (restoredOnce.current) return;
      restoredOnce.current = true;
      const valid = new Set(chunks.map((c) => c.id));
      // A shared link's picks win over what this browser had saved.
      const fromLink = (initialPicks ?? []).filter((id) => valid.has(id));
      const saved = fromLink.length
        ? fromLink
        : (loadPicked(mode) ?? []).filter((id) => valid.has(id));
      if (saved.length > 0) setPicked(saved);
      setRestored(true);
    }, 0);
    return () => clearTimeout(t);
  }, [chunks, initialPicks, mode]);
  useEffect(() => {
    if (restored) savePicked(picked, mode);
  }, [picked, restored, mode]);

  const visible = useMemo(() => {
    if (view === "top-clicks")
      return chunks.filter((c) => c.rank).sort((a, b) => a.rank! - b.rank!);
    if (view === "section") return chunks.filter((c) => c.section === section);
    return chunks;
  }, [view, section, chunks]);

  const full = picked.length >= MAX;
  const addHighlight = (chunk: Chunk) => {
    setExtra((e) => [...e, chunk]);
    setPicked((p) =>
      p.length >= MAX || p.includes(chunk.id) ? p : [...p, chunk.id],
    );
  };
  const removeHighlight = (id: number) => {
    setRemoved((r) => [...r, id]);
    setExtra((e) => e.filter((c) => c.id !== id));
    setPicked((p) => p.filter((x) => x !== id));
  };
  const toggle = (id: number) =>
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length >= MAX
          ? p
          : [...p, id],
    );
  const topIds = (n: number) => topIdsOf(chunks, n);
  // A quick-select chip lights up while the current picks are exactly that top N.
  const activeTop = [3, 5, 10].find((n) => {
    const ids = topIds(n);
    return (
      ids.length === picked.length && ids.every((id) => picked.includes(id))
    );
  });
  const selectTop = (n: number) => setPicked(activeTop === n ? [] : topIds(n));

  const tabs: {
    id: View;
    label: string;
    hint: string;
    icon: LucideIcon;
    short?: string;
    disabled?: boolean;
  }[] = [
    {
      id: "top-clicks",
      label: "Top clicks",
      hint: "Ranked by reader clicks",
      icon: MousePointerClick,
      disabled: !hasClicks,
    },
    {
      id: "section",
      label: "Section",
      hint: "One part of the issue",
      icon: LayoutList,
    },
    ...(manual
      ? [
          {
            id: "manual" as const,
            label: "Manual",
            hint: "Highlight text in the issue as published",
            icon: Highlighter,
          },
        ]
      : []),
  ];

  // Section / group labels are shown where they change from the previous visible item.
  const labels = useMemo(
    () =>
      visible.map((c, i) => {
        const prev = visible[i - 1];
        return {
          topic:
            view !== "top-clicks" && c.topic && c.topic !== prev?.topic
              ? c.topic
              : null,
          // An underlined or plain label: a subheader. A bold one is already shown as the topic pill.
          group:
            view !== "top-clicks" &&
            c.group &&
            c.group !== c.topic &&
            (c.group !== prev?.group || c.topic !== prev?.topic)
              ? c.group
              : null,
        };
      }),
    [visible, view],
  );

  return (
    <>
      {!manualOnly && (
      <div
        role="tablist"
        aria-label="How to choose"
        className="flex items-end gap-1.5 px-3 sm:pl-6 sm:pr-0"
      >
        {tabs.filter((t) => !manualOnly || t.id === "manual").map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-label={t.label}
            aria-selected={view === t.id}
            disabled={t.disabled}
            onClick={() => setView(t.id)}
            title={t.disabled ? "Needs the newsletter's beehiiv key" : t.hint}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-t-2xl px-2 text-sm font-bold transition min-[420px]:text-base sm:flex-none sm:px-6 sm:text-lg ${
              view === t.id
                ? `${ACCENT[t.id].solid} relative z-10 -mb-[3px] py-3.5 text-ink-deep`
                : `${ACCENT[t.id].light} py-2.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`
            }`}
          >
            <t.icon
              aria-hidden
              className="hidden size-5 shrink-0 sm:block"
              strokeWidth={2.25}
            />
            {t.short ? (
              <>
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </>
            ) : (
              t.label
            )}
          </button>
        ))}
      </div>
      )}

      <div
        className={`mb-4 rounded-2xl border-[3px] p-4 sm:p-5 ${ACCENT[view].border}`}
      >
        {view === "section" && (
          <label className="mb-4 flex flex-wrap items-center gap-3 text-sm font-semibold">
            Section
            <span className="min-w-0 flex-1">
              <Select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="font-semibold"
              >
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </span>
          </label>
        )}

        {view === "top-clicks" && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="hidden font-semibold sm:inline">
              Quick select:
            </span>
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => selectTop(n)}
                aria-pressed={activeTop === n}
                className={`rounded-full px-3 py-1 font-bold transition ${activeTop === n ? ACCENT[view].solid : ACCENT[view].light}`}
              >
                Top {n}
              </button>
            ))}
            {picked.length > 0 && (
              <button
                onClick={() => setPicked([])}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold underline-offset-4 hover:underline"
              >
                <X aria-hidden className="size-4" strokeWidth={2.5} />
                Clear selection
              </button>
            )}
            <span className="w-full text-xs sm:ml-auto sm:w-auto">
              Upcoming events only
            </span>
          </div>
        )}

        {view === "manual" && (
          <ManualPane
            mode={mode}
            full={full}
            highlights={chunks
              .filter((c) => isCustomId(c.id))
              .map((c) => ({
                id: c.id,
                text: c.text,
                url: c.url,
                pick: picked.indexOf(c.id) + 1,
              }))}
            onAdd={(c) => addHighlight(c as Chunk)}
            onRemove={removeHighlight}
            onToggle={toggle}
          />
        )}

        {view !== "manual" && (
          <ul className="flex flex-col gap-2">
            {visible.map((c, i) => {
              const idx = picked.indexOf(c.id);
              const on = idx >= 0;
              const disabled = !on && full;
              const { topic: top, group: grp } = labels[i];
              return (
                <li key={c.id} className="contents">
                  {top && (
                    <p
                      className={`mt-4 w-fit rounded-full px-3 py-1 text-base font-bold text-ink-deep bg-sage`}
                    >
                      {top}
                    </p>
                  )}
                  {grp && (
                    <p className="mt-2 text-xs font-bold text-ink-deep">
                      {grp}
                    </p>
                  )}
                  <label
                    className={`relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 pr-12 ring-1 transition ${
                      on
                        ? `${ACCENT[view].solid} ring-2 ring-ink`
                        : "bg-surface ring-ink/10 hover:ring-ink/30"
                    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggle(c.id)}
                      className="sr-only"
                    />
                    {(() => {
                      const { icon: Kind, label } = elementType(c);
                      return (
                        <span
                          title={label}
                          className="absolute right-4 top-4 text-ink/60"
                        >
                          <Kind
                            aria-hidden
                            className="size-4"
                            strokeWidth={2.25}
                          />
                          <span className="sr-only">{label}</span>
                        </span>
                      );
                    })()}
                    <span
                      aria-hidden
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? "bg-ink text-cream" : "border-2 border-ink/30"}`}
                    >
                      {on ? idx + 1 : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-x-2">
                        {view === "top-clicks" && c.rank && (
                          <span className="shrink-0 font-display text-ink/60">
                            #{c.rank}
                          </span>
                        )}
                        <span className="font-bold">
                          {c.kind === "paragraph" && !c.body
                            ? clamp(c.text, 160)
                            : c.title}
                        </span>
                      </span>
                      {c.kind === "bullet" ? (
                        <>
                          {(c.when || c.place) && (
                            <span className="mt-0.5 block text-sm font-semibold text-ink/80">
                              {[c.when, c.place].filter(Boolean).join(" · ")}
                            </span>
                          )}
                          {c.blurb && (
                            <Description text={c.blurb} className="mt-1" />
                          )}
                        </>
                      ) : (
                        c.body && (
                          <Description text={c.body} className="mt-0.5" />
                        )
                      )}
                      {c.score != null && (
                        <span className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink/70">
                          <MousePointerClick
                            aria-hidden
                            className="size-3.5"
                            strokeWidth={2.25}
                          />
                          {c.score} unique clicks
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="rounded-2xl bg-surface p-6 text-center">
                Nothing to show here.
              </li>
            )}
          </ul>
        )}
      </div>

      <FlowBar
        next={picked.length > 0 ? { href: stepUrl(mode, "design", `picks=${picked.join(",")}`) } : null}
        back={{ href: "/source", label: "Source" }}
        status={
          <>
            {picked.length === 0
              ? "Select 1 to 20 items"
              : `${picked.length} of ${MAX} selected`}
            {full && <span className="ml-2 font-normal">Maximum reached</span>}
          </>
        }
      >
        {picked.length > 0 && (
          <button
            onClick={() => setPicked([])}
            className="text-sm font-semibold underline underline-offset-4"
          >
            Clear
          </button>
        )}
        {picked.length === 0 ? (
          <span aria-disabled className={primaryDisabled}>
            Continue
          </span>
        ) : (
          <Link
            href={stepUrl(mode, "design", `picks=${picked.join(",")}`)}
            className={primaryButton}
          >
            Continue
          </Link>
        )}
      </FlowBar>
    </>
  );
}

const clamp = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

/** A description limited to two lines, with Expand / Collapse when it runs longer. The toggle never changes the pick. */
function Description({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only measure while clamped; once expanded the text always fits.
    const measure = () => {
      if (!open) setLong(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <span className={`block ${className}`}>
      <span
        ref={ref}
        className={`block text-sm leading-relaxed ${open ? "" : "line-clamp-2"}`}
      >
        {text}
      </span>
      {(long || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="mt-0.5 text-xs font-bold underline underline-offset-4"
        >
          {open ? "Collapse" : "Expand"}
        </button>
      )}
    </span>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPicked, savePicked } from "@/lib/progress";
import Link from "next/link";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { isDemo, stepUrl } from "@/lib/flow";
import {
  AlignLeft,
  ArrowUp,
  LayoutList,
  Link2,
  List,
  Highlighter,
  MousePointerClick,
  X,
  type LucideIcon,
} from "lucide-react";
import { isCustomId } from "@/lib/pollen/custom";
import { instagramPostKey, instagramTag, type KnownHandles } from "@/lib/pollen/url";
import { ApifyConnect } from "@/components/ApifyConnect";
import { TagChip, type TagState } from "./TagChip";
import { ManualPane, deleteHighlight } from "./ManualPane";
import { PickTray, type TrayItem } from "./PickTray";
import { PreviewButton } from "./PreviewButton";
import { MAX_DEMO_WORDS, demoWords } from "@/lib/pollen/demoHighlights";
import { CUSTOM_BASE } from "@/lib/pollen/custom";
import type { View } from "./picking";
import { RunAutosave } from "@/components/RunAutosave";

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
/** The public demo is capped lower, across everything picked (highlights included), so there is one limit to understand. */
const MAX_DEMO_PICKS = 5;
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
  issueKey,
  chunks: serverChunks,
  hasClicks,
  initialView,
  initialPicks,
  manual = false,
  manualOnly = false,
  knownHandles,
  lookups = false,
}: {
  mode: string;
  /** Which issue these chunks are from (its address). Picks are positions in one issue's list, so saved picks are only restored for the same issue, even when `mode` is the same ("own" = the latest issue of whichever publication is chosen). */
  issueKey?: string;
  chunks: Chunk[];
  /** Something in the issue is ranked by clicks (beehiiv returning click rows is not enough). The Top clicks tab is off without it. */
  hasClicks: boolean;
  initialView?: View;
  initialPicks?: number[];
  /** Show the Manual tab (highlight text in the issue as published). Only for the user's own issues. */
  manual?: boolean;
  /** Only the Manual tab: the page is one the visitor pasted, so there is nothing parsed to browse. */
  manualOnly?: boolean;
  /** Accounts already looked up for this issue's Instagram post links (cached answers). */
  knownHandles?: KnownHandles;
  /** Signed in: a picked post link is looked up (the server decides whether this account may). The public demo only shows cached answers. */
  lookups?: boolean;
}) {
  const scope = issueKey ? `${mode}|${issueKey}` : mode;
  const limit = mode === "demo" ? MAX_DEMO_PICKS : MAX;
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
  // Clicks were recorded, but every ranked item may be over (an old issue of an events newsletter): then start on Section instead.
  const anyRanked = hasClicks && serverChunks.some((c) => c.rank);
  const [view, setViewState] = useState<View>(
    manualOnly
      ? "manual"
      : initialView === "manual" && !manual
      ? "section"
      : initialView === "top-clicks" && !anyRanked
        ? "section"
        : (initialView ??
          (anyRanked
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
  // The section whose heading is at the top of the screen, lit in the jump bar.
  const [section, setSection] = useState(sections[0] ?? "");
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
      const fromLink = (initialPicks ?? []).filter((id) => valid.has(id)).slice(0, limit);
      const saved = fromLink.length
        ? fromLink
        : (loadPicked(scope) ?? []).filter((id) => valid.has(id)).slice(0, limit);
      if (saved.length > 0) setPicked(saved);
      setRestored(true);
    }, 0);
    return () => clearTimeout(t);
  }, [chunks, initialPicks, scope, limit]);
  useEffect(() => {
    if (restored) savePicked(picked, scope);
  }, [picked, restored, scope]);

  const visible = useMemo(() => {
    if (view === "top-clicks")
      return chunks.filter((c) => c.rank).sort((a, b) => a.rank! - b.rank!);
    if (view === "section") return chunks.filter((c) => !isCustomId(c.id));
    return chunks;
  }, [view, chunks]);

  // A section often opens with a line of introduction (no link, no date, nothing to post): shown as plain text under its heading,
  // not as a pick.
  const intros = useMemo(() => {
    const ids = new Set<number>();
    if (view !== "section") return ids;
    visible.forEach((c, i) => {
      if (c.section === visible[i - 1]?.section) return;
      const rest = visible.slice(i + 1).filter((x) => x.section === c.section);
      if (c.kind === "paragraph" && !c.url && !c.when && !c.rank && !c.body && rest.some((x) => x.kind === "bullet")) ids.add(c.id);
    });
    return ids;
  }, [view, visible]);

  const jumpTo = (sec: string) => {
    setSection(sec);
    document.getElementById(`section-${sections.indexOf(sec)}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  // Light the pill of the section being read.
  useEffect(() => {
    if (view !== "section" || sections.length < 2) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      let current = 0;
      sections.forEach((_, i) => {
        const el = document.getElementById(`section-${i}`);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.35) current = i;
      });
      setSection(sections[current]);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [view, sections]);

  const full = picked.length >= limit;
  // Picks whose link is an Instagram account (or a post, once its account is looked up) get tagged in the Instagram caption (Write step).
  const byId = useMemo(() => new Map(chunks.map((c) => [c.id, c])), [chunks]);
  const [found, setFound] = useState<KnownHandles>(knownHandles ?? {});
  const [lookup, setLookup] = useState<Record<string, "loading" | "failed" | "missing" | "limit" | "paused" | "refused">>({});
  const tried = useRef(new Set<string>());
  const settle = useCallback((key: string, to?: "failed" | "missing" | "limit" | "paused" | "refused") => {
    setLookup((l) => {
      const next = { ...l };
      if (to) next[key] = to;
      else delete next[key];
      return next;
    });
  }, []);
  // One post link -> its account, through the server (cache first, then Apify for allowed accounts).
  const resolve = useCallback(
    async (key: string, url: string) => {
      await Promise.resolve();
      setLookup((l) => ({ ...l, [key]: "loading" }));
      try {
        const r = await fetch("/api/instagram/handle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const j = (await r.json().catch(() => null)) as { handle?: string; error?: string } | null;
        if (r.ok && j?.handle) {
          setFound((f) => ({ ...f, [key]: j.handle! }));
          settle(key);
        } else if (r.status === 401) settle(key); // signed out: nothing to look up with
        else if (j?.error === "limit-reached") settle(key, "limit");
        else if (j?.error === "capped") settle(key, "paused");
        else if (j?.error === "own-token") settle(key, "refused");
        else settle(key, r.status === 404 ? "missing" : "failed");
      } catch {
        settle(key, "failed");
      }
    },
    [settle],
  );
  // Look up when a post link is picked: restored picks, quick-select chips and highlights all come through here.
  useEffect(() => {
    if (!lookups) return;
    for (const id of picked) {
      const url = byId.get(id)?.url ?? null;
      const key = instagramPostKey(url);
      if (!url || !key || found[key] || tried.current.has(key)) continue;
      tried.current.add(key);
      void resolve(key, url);
    }
  }, [picked, byId, lookups, found, resolve]);
  const tagOf = (url: string | null) => instagramTag(url, found);
  const tagState = (url: string | null): TagState => {
    const handle = tagOf(url);
    if (handle) return { kind: "handle", handle };
    const key = instagramPostKey(url);
    if (!key || !lookups) return null;
    const st = lookup[key];
    if (st === "loading") return { kind: "loading" };
    if (st === "missing") return { kind: "missing" };
    if (st === "limit") return { kind: "limit", onConnect: () => setTokenOpen(true) };
    if (st === "refused") return { kind: "refused", onConnect: () => setTokenOpen(true) };
    if (st === "paused") return { kind: "paused" };
    if (st === "failed") return { kind: "failed", onRetry: () => void resolve(key, url!) };
    return null;
  };
  // The token form opens from a "used up" chip. Once a token is saved, every picked post that was waiting is looked up again.
  const [tokenOpen, setTokenOpen] = useState(false);
  const tokenDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = tokenDialog.current;
    if (tokenOpen && d && !d.open) d.showModal();
  }, [tokenOpen]);
  const retryWaiting = () => {
    for (const id of picked) {
      const url = byId.get(id)?.url ?? null;
      const key = instagramPostKey(url);
      if (url && key && !found[key] && ["limit", "refused", "failed"].includes(lookup[key] ?? "")) void resolve(key, url);
    }
  };
  const taggedCount = picked.filter((id) => tagOf(byId.get(id)?.url ?? null)).length;
  const addHighlight = (chunk: Chunk) => {
    setExtra((e) => [...e, chunk]);
    setPicked((p) =>
      p.length >= limit || p.includes(chunk.id) ? p : [...p, chunk.id],
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
        : p.length >= limit
          ? p
          : [...p, id],
    );
  // One tray on every tab: everything picked, parsed picks and highlights together, in pick order. Adding or removing works
  // the same from a tab or from the tray itself.
  const [trayNote, setTrayNote] = useState<string | null>(null);
  const trayItems: TrayItem[] = [
    ...picked.flatMap((id, i) => {
      const c = byId.get(id);
      return c ? [{ id, text: isCustomId(id) ? c.text : c.title, url: c.url, pick: i + 1, tag: tagState(c.url), highlight: isCustomId(id) }] : [];
    }),
  ];
  const removeFromTray = async (id: number) => {
    setTrayNote(null);
    if (!isCustomId(id)) return toggle(id);
    const err = await deleteHighlight(mode, id);
    if (err) return setTrayNote(err);
    removeHighlight(id);
  };
  // A highlight lives only while it is picked: when a new selection leaves one out (Top 3/5, Clear), it is deleted.
  const replacePicks = (next: number[]) => {
    setPicked(next);
    for (const c of chunks) {
      if (isCustomId(c.id) && !next.includes(c.id)) void deleteHighlight(mode, c.id).then((err) => { if (!err) removeHighlight(c.id); });
    }
  };
  // Highlights saved before but not picked no longer exist as such: drop them once, after the picks are restored.
  const pruned = useRef(false);
  useEffect(() => {
    if (!restored || pruned.current || initialPicks?.length) return;
    pruned.current = true;
    for (const c of chunks) {
      if (isCustomId(c.id) && !picked.includes(c.id)) void deleteHighlight(mode, c.id).then((err) => { if (!err) removeHighlight(c.id); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);
  const demoMode = isDemo(mode);
  const topIds = (n: number) => topIdsOf(chunks, n);
  // A quick-select chip lights up while the current picks are exactly that top N.
  const topChips = [3, 5, 10].filter((n) => n <= limit);
  const activeTop = topChips.find((n) => {
    const ids = topIds(n);
    return (
      ids.length === picked.length && ids.every((id) => picked.includes(id))
    );
  });
  const selectTop = (n: number) => replacePicks(activeTop === n ? [] : topIds(n).slice(0, limit));

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
            title={t.disabled ? "No items in this issue have click data to rank" : t.hint}
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
        {view === "section" && sections.length > 1 && (
          <nav id="section-nav" aria-label="Jump to section" className="mb-5 flex flex-wrap gap-2 text-sm sm:text-lg">
            {sections.map((sec) => {
              const active = sec === section;
              const n = visible.filter((c) => c.section === sec && picked.includes(c.id)).length;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => jumpTo(sec)}
                  aria-current={active ? "true" : undefined}
                  data-active={active || undefined} className={`flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 text-left font-bold leading-tight transition sm:px-5 sm:py-2.5 ${active ? "bg-ink text-cream" : "bg-ink/10 ring-1 ring-ink/15 hover:bg-ink/15"}`}
                >
                  <span className="min-w-0 truncate">{sec}</span>
                  {n > 0 && (
                    <span aria-label={`${n} picked`} className="grid size-6 shrink-0 place-items-center rounded-full bg-honey text-sm text-ink-deep">
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {view === "top-clicks" && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {topChips.map((n) => (
              <button
                key={n}
                onClick={() => selectTop(n)}
                aria-pressed={activeTop === n}
                className={`min-h-11 rounded-full px-4 py-1 font-bold transition ${activeTop === n ? ACCENT[view].solid : ACCENT[view].light}`}
              >
                Top {n}
              </button>
            ))}
            {picked.length > 0 && (
              <button
                onClick={() => replacePicks([])}
                className="inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 py-1 font-semibold underline-offset-4 hover:underline"
              >
                <X aria-hidden className="size-4" strokeWidth={2.5} />
                Clear selection
              </button>
            )}
            <span className="w-full text-xs sm:ml-auto sm:w-auto italic">
              For events: Showing upcoming events only
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
                tag: tagState(c.url),
              }))}
            onAdd={(c) => addHighlight(c as Chunk)}
            onRemove={removeHighlight}
          />
        )}

        <PickTray
          mode={mode}
          items={trayItems}
          full={full}
          meter={
            demoMode
              ? {
                  count: picked.length,
                  maxCount: limit,
                  maxWords: MAX_DEMO_WORDS,
                  words: demoWords(
                    chunks
                      .filter((c) => isCustomId(c.id))
                      .map((c) => ({ id: c.id - CUSTOM_BASE, text: c.text, url: c.url })),
                  ),
                }
              : undefined
          }
          note={trayNote}
          onRemove={removeFromTray}
          onToggle={toggle}
        />

        {view !== "manual" && (
          <ul className="flex flex-col gap-2">
            {visible.map((c, i) => {
              const startsSection = view === "section" && c.section !== visible[i - 1]?.section;
              const heading = startsSection && (
                <h2
                  id={`section-${sections.indexOf(c.section)}`}
                  className={`mb-1 scroll-mt-4 font-display text-2xl leading-tight ${i === 0 ? "mt-0" : "mt-8"}`}
                >
                  {c.section}
                </h2>
              );
              if (intros.has(c.id)) return <li key={c.id} className="contents">{heading}<p className="mb-2 mt-0 text-lg">{c.text}</p></li>;
              const idx = picked.indexOf(c.id);
              const on = idx >= 0;
              const disabled = !on && full;
              const { topic: top, group: grp } = labels[i];
              return (
                <li key={c.id} className="contents">
                  {heading}
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
                    className={`relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 pr-20 ring-1 transition ${
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
                        <span className="absolute right-1 top-1 flex items-center">
                          <PreviewButton mode={mode} id={c.id} label={clamp(c.title || c.text, 50)} className="size-8 hover:bg-ink/10" />
                          <span title={label} className="grid min-w-8 place-items-center text-ink/75">
                            {view === "top-clicks" && c.rank && (
                              <span aria-hidden className="font-display text-base leading-none">
                                #{c.rank}
                              </span>
                            )}
                            <Kind
                              aria-hidden
                              className={`size-4 ${view === "top-clicks" && c.rank ? "hidden" : ""}`}
                              strokeWidth={2.25}
                            />
                            <span className="sr-only">{label}</span>
                          </span>
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
                      <TagChip state={tagState(c.url)} className="mt-2" />
                    </span>
                  </label>
                  {view === "section" && sections.length > 1 && c.section !== visible[i + 1]?.section && (
                    <button
                      type="button"
                      onClick={() => document.getElementById("section-nav")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" })}
                      className="mb-2 mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
                    >
                      <ArrowUp aria-hidden className="size-4" strokeWidth={2.5} />
                      Back to sections
                    </button>
                  )}
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="rounded-2xl bg-surface p-6 text-center">
                {view === "top-clicks"
                  ? "Nothing to rank here: the events in this issue are over, or none of its links were clicked. Try the Section tab."
                  : "Nothing to show here."}
              </li>
            )}
          </ul>
        )}
      </div>

      {lookups && tokenOpen && (
        <dialog
          ref={tokenDialog}
          onClose={() => setTokenOpen(false)}
          aria-labelledby="apify-title"
          className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-cream p-6 text-ink shadow-xl backdrop:bg-ink/50"
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 id="apify-title" className="m-0 text-2xl">
              Add your Apify token
            </h2>
            <button type="button" onClick={() => tokenDialog.current?.close()} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-ink/10">
              <X aria-hidden className="size-5" strokeWidth={2.5} />
            </button>
          </div>
          <p className="mb-4 mt-0 text-sm">You&rsquo;ve used your free account lookups. With your own Apify token you can keep tagging Instagram posts.</p>
          <ApifyConnect
            initial={null}
            onChange={(s) => {
              if (!s) return;
              tokenDialog.current?.close();
              retryWaiting();
            }}
          />
        </dialog>
      )}

      <RunAutosave source={mode} picks={picked} template="" step={2} enabled={restored && !demoMode && picked.length > 0} />
      <FlowBar
        next={picked.length > 0 ? { href: stepUrl(mode, "design", `picks=${picked.join(",")}`) } : null}
        back={{ href: "/source", label: "Source" }}
        status={
          <>
            <span className="sm:hidden">{picked.length === 0 ? `Pick 1\u2013${limit}` : `${picked.length}/${limit}`}</span>
            <span className="hidden sm:inline">
              {picked.length === 0
                ? `Select 1 to ${limit} items`
                : `${picked.length} of ${limit} selected${taggedCount > 0 ? ` · ${taggedCount} to tag on Instagram` : ""}`}
              {full && <span className="ml-2 font-normal">Maximum reached</span>}
            </span>
          </>
        }
      >
        {picked.length > 0 && (
          <button
            onClick={() => replacePicks([])}
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

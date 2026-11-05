"use client";

import { Check, Highlighter, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isDemo } from "@/lib/flow";
import {
  CUSTOM_BASE,
  MAX_HIGHLIGHT,
  MAX_HIGHLIGHTS_PER_ISSUE,
  cleanHighlight,
  customChunk,
} from "@/lib/pollen/custom";
import { track } from "@/lib/events";
import { PickTray } from "./PickTray";
import type { TagState } from "./TagChip";
import { readDemoSource } from "@/lib/pollen/demoSource";
import {
  MAX_DEMO_HIGHLIGHTS,
  MAX_DEMO_WORDS,
  demoWords,
  wordCount,
  readDemoRows,
  writeDemoRows,
} from "@/lib/pollen/demoHighlights";

/** What gets saved as a highlight: a selection, or a whole paragraph or list item picked with its "+". */
type Pickable = { text: string; url: string | null; linkText: string | null };
/** A paragraph or list item of the issue, with where its "+" goes (in the frame's own coordinates). */
type Block = Pickable & { key: number; top: number; left: number; flat: string };
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

type Selection =
  | { text: string; url: string | null; linkText: string | null; left: number; top: number }
  | { tooLong: true; left: number; top: number };

const buttonStyle =
  "absolute z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-lg";
// On a touch screen the phone's own menu (Copy, Look Up, the floating toolbar) opens right above the selection, exactly where a floating
// button would go. So there the button is docked at the bottom of the screen, above the step bar, where nothing else appears.
const dockedStyle = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-bold shadow-lg";

/**
 * The issue as published, in a sandboxed iframe without scripts. Select any text in it and press Pick: the highlight is
 * saved as an extra chunk of the issue (see /api/picks/custom), so the later steps handle it like any other pick.
 */
export function ManualPane({
  mode,
  highlights,
  full,
  onAdd,
  onRemove,
  onToggle,
}: {
  mode: string;
  /** `pick` is the 1-based pick number, or 0 when the highlight is saved but not picked. */
  highlights: { id: number; text: string; url: string | null; pick: number; tag?: TagState }[];
  /** The pick limit is reached. */
  full: boolean;
  onAdd: (chunk: unknown) => void;
  onRemove: (id: number) => void;
  onToggle: (id: number) => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [height, setHeight] = useState(600);
  const [sel, setSel] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // The public demo has no account: its highlights are kept in a cookie in this browser instead of the database.
  const demo = isDemo(mode);
  const frame = useRef<HTMLIFrameElement>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(pointer: coarse)");
    const set = () => setTouch(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  const cleanup = useRef<() => void>(() => {});
  const [blocks, setBlocks] = useState<Block[]>([]);
  const picked = new Set(highlights.map((h) => flat(h.text)));
  const hasSel = sel !== null;
  // The part of the issue (in the frame's own coordinates) that is on screen above the step bar: where the floating button may sit.
  const [view, setView] = useState<{ min: number; max: number } | null>(null);
  useEffect(() => {
    if (!hasSel || touch) return;
    const read = () => {
      const fr = frame.current?.getBoundingClientRect();
      if (!fr) return;
      const min = 8 - fr.top;
      setView({ min, max: Math.max(window.innerHeight - fr.top - 140, min) });
    };
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [hasSel, touch]);
  /** Keeps the floating button inside the part of the issue that is on screen, so a long selection never leaves it off the top. */
  const floatTop = (top: number) => (view ? Math.min(Math.max(top, view.min), view.max) : top);

  useEffect(() => {
    let cancelled = false;
    // A pasted public page (kept in a cookie) stands in for the sample issue in the demo.
    const src = demo ? readDemoSource() : null;
    fetch(
      src
        ? `/api/demo/source?url=${encodeURIComponent(src.url)}`
        : demo
          ? "/api/demo/document"
          : `/api/issue/document?mode=${encodeURIComponent(mode)}`,
    )
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          html?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.html)
          setLoadError(data.error ?? "Couldn't load the issue as published.");
        else setHtml(data.html);
      })
      .catch(
        () =>
          !cancelled &&
          setLoadError(
            "Couldn't reach Pollen Picks. Check your connection and try again.",
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [mode, demo]);
  useEffect(() => () => cleanup.current(), []);

  // The iframe is same-origin but has no scripts, so this page reads its selection and sizes it from outside.
  function attach() {
    cleanup.current();
    const el = frame.current;
    const doc = el?.contentDocument;
    if (!el || !doc?.body) return;
    // The page's own styles can make elements as tall as the frame (min-height: 100vh, and the like), and that includes stylesheets we
    // can't rewrite. Measured at the frame's current size, such a page is always a little taller than the frame, so the frame grows
    // after every measurement, without end. So it is measured at a small size, where only the real content is taller, and the frame
    // is put back before anything is drawn.
    // Safety stop: a height that keeps changing (more than 10 times in 2 seconds) is a feedback loop, not a page loading. Keep the last
    // height and stop measuring, rather than let the frame run away.
    let last = 0;
    let changes: number[] = [];
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const before = el.style.height;
      el.style.height = "100px";
      const h = Math.max(Math.ceil(doc.body.getBoundingClientRect().height), doc.documentElement.scrollHeight, doc.body.scrollHeight, 200);
      el.style.height = before;
      if (Math.abs(last - h) < 2) return;
      const now = Date.now();
      changes = [...changes.filter((t) => now - t < 2000), now];
      if (changes.length > 10) return ro?.disconnect();
      last = h;
      setHeight(h);
    };
    // A "+" beside every heading, paragraph and list item, as a way to pick that does not depend on selecting text (which phones make awkward).
    const layoutBlocks = () => {
      const width = el.clientWidth;
      const out: Block[] = [];
      let key = 0;
      for (const b of doc.body.querySelectorAll("p, li, h1, h2, h3, h4")) {
        if (b.tagName === "P" && b.closest("li")) continue; // the list item itself is the pick
        if (b.tagName === "LI" && b.querySelector("li")) continue; // a list that holds lists: its items are the picks
        const raw = cleanHighlight(b.textContent ?? "");
        // Headings are short by nature ("Events"); a paragraph that short is not worth a button.
        if (!raw || raw.length < (/^H[1-4]$/.test(b.tagName) ? 2 : 8)) continue;
        const rect = b.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 8) continue;
        const a = b.querySelector("a[href]");
        const linkText = a ? flat(a.textContent ?? "") || null : null;
        out.push({
          key: key++,
          top: rect.top + doc.documentElement.scrollTop,
          left: Math.min(rect.right + 8, Math.max(width - 38, 0)),
          text: raw,
          url: a?.getAttribute("href") ?? null,
          linkText,
          flat: flat(raw),
        });
      }
      setBlocks(out);
    };
    const measureAll = () => {
      measure();
      layoutBlocks();
    };
    measureAll();
    ro = new ResizeObserver(measureAll);
    ro.observe(doc.body);

    const check = () => {
      const s = doc.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0) return setSel(null);
      const raw = s.toString();
      const range = s.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, 70),
        Math.max(el.clientWidth - 70, 70),
      );
      const top = Math.max(rect.top - 48, 4);
      const text = cleanHighlight(raw);
      if (!text)
        return setSel(
          raw.trim().length > MAX_HIGHLIGHT
            ? { tooLong: true, left, top }
            : null,
        );
      const a =
        range.cloneContents().querySelector("a[href]") ??
        (range.commonAncestorContainer as Node).parentElement?.closest(
          "a[href]",
        );
      // The first link's text becomes the pick's title. Inside a partly selected link, only what was selected counts.
      const linkText = a?.getAttribute("href") ? (a.textContent ?? "").replace(/\s+/g, " ").trim() || null : null;
      setSel({ text, url: a?.getAttribute("href") ?? null, linkText, left, top });
      setNote(null);
    };
    const later = () => setTimeout(check, 0);
    const noLinks = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("a")) e.preventDefault();
    };
    for (const t of ["mouseup", "keyup", "touchend"])
      doc.addEventListener(t, later);
    doc.addEventListener("selectionchange", later);
    doc.addEventListener("click", noLinks);
    cleanup.current = () => {
      ro?.disconnect();
      for (const t of ["mouseup", "keyup", "touchend"])
        doc.removeEventListener(t, later);
      doc.removeEventListener("selectionchange", later);
      doc.removeEventListener("click", noLinks);
    };
  }

  async function pick(target?: Pickable) {
    const t: Pickable | null = target ?? (sel && !("tooLong" in sel) ? sel : null);
    if (!t || busy) return;
    if (full)
      return setNote("You've reached the pick limit. Remove a pick first.");
    setBusy(true);
    setNote(null);
    try {
      if (demo) {
        const rows = readDemoRows();
        if (rows.length >= MAX_DEMO_HIGHLIGHTS)
          return setNote(
            `The demo keeps up to ${MAX_DEMO_HIGHLIGHTS} highlights. Remove one first.`,
          );
        const left = MAX_DEMO_WORDS - demoWords(rows);
        if (wordCount(t.text) > left)
          return setNote(
            left > 0
              ? `The demo allows ${MAX_DEMO_WORDS} highlighted words in total, and you have ${left} left. Select less, or remove a highlight first.`
              : `You've used the demo's ${MAX_DEMO_WORDS} highlighted words. Remove a highlight first.`,
          );
        const id = Math.max(0, ...rows.map((r) => r.id)) + 1;
        let row = { id, text: t.text, url: t.url, linkText: t.linkText };
        let linkDropped = false;
        // Long links are what fill the cookie, so the link goes before the text does.
        if (!writeDemoRows([...rows, row])) {
          row = { ...row, url: null, linkText: null };
          linkDropped = Boolean(t.url);
          if (!writeDemoRows([...rows, row]))
            return setNote("The demo can't hold any more highlight text. Remove one first.");
        }
        track("highlight_added");
        onAdd(customChunk(row));
        frame.current?.contentDocument?.getSelection()?.removeAllRanges();
        setSel(null);
        if (linkDropped) setNote("Saved without its link: the demo is short on space.");
        return;
      }
      const res = await fetch("/api/picks/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text: t.text, url: t.url, linkText: t.linkText }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        chunk?: unknown;
        error?: string;
      };
      if (!res.ok || !data.chunk)
        return setNote(
          data.error ?? "Couldn't save the highlight. Try again in a moment.",
        );
      onAdd(data.chunk);
      frame.current?.contentDocument?.getSelection()?.removeAllRanges();
      setSel(null);
    } catch {
      setNote(
        "Couldn't reach Pollen Picks. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setNote(null);
    try {
      if (demo) {
        writeDemoRows(readDemoRows().filter((r) => r.id !== id - CUSTOM_BASE));
        return onRemove(id);
      }
      const res = await fetch(
        `/api/picks/custom?mode=${encodeURIComponent(mode)}&id=${id}`,
        { method: "DELETE" },
      );
      if (!res.ok)
        return setNote("Couldn't remove the highlight. Try again in a moment.");
      onRemove(id);
    } catch {
      setNote(
        "Couldn't reach Pollen Picks. Check your connection and try again.",
      );
    }
  }

  // At a limit the selection can't be picked: say why instead of offering a button that fails.
  const usedWords = demo
    ? demoWords(highlights.map((h) => ({ id: h.id - CUSTOM_BASE, text: h.text, url: h.url })))
    : 0;
  const limit = full
    ? "You've reached the pick limit. Remove a pick first."
    : demo && highlights.length >= MAX_DEMO_HIGHLIGHTS
      ? `The demo holds ${MAX_DEMO_HIGHLIGHTS} highlights. Remove one to add another.`
      : demo && usedWords >= MAX_DEMO_WORDS
        ? `You've used the demo's ${MAX_DEMO_WORDS} words. Remove a highlight first.`
        : !demo && highlights.length >= MAX_HIGHLIGHTS_PER_ISSUE
          ? `You can keep up to ${MAX_HIGHLIGHTS_PER_ISSUE} highlights per issue. Remove one first.`
          : null;

  return (
    <div>
      <p className="mb-3 mt-0 text-sm">
        <Highlighter
          aria-hidden
          className="mr-1.5 inline size-4 align-[-0.15em]"
          strokeWidth={2.25}
        />
        {touch ? (
          <>Tap <strong>+</strong> beside a paragraph or heading to pick it. Or touch and hold a word, drag the handles to select part of one, then press <strong>Pick</strong> at the bottom of the screen.</>
        ) : (
          <>Select any text in the issue below, then press <strong>Pick</strong>. Or press <strong>+</strong> beside a paragraph or heading to pick all of it, and again to take it back.</>
        )}{" "}
        Links aren&rsquo;t clickable here.
      </p>

      <PickTray
        items={highlights}
        full={full}
        meter={
          demo
            ? {
                count: highlights.length,
                maxCount: MAX_DEMO_HIGHLIGHTS,
                maxWords: MAX_DEMO_WORDS,
                words: demoWords(
                  highlights.map((h) => ({ id: h.id - CUSTOM_BASE, text: h.text, url: h.url })),
                ),
              }
            : undefined
        }
        onRemove={remove}
        onToggle={onToggle}
      />

      {note && (
        <p
          role="alert"
          className="mb-3 mt-0 border-l-4 border-coral pl-3 text-sm font-semibold"
        >
          {note}
        </p>
      )}

      {loadError ? (
        <p role="alert" className="border-l-4 border-coral pl-3 font-semibold">
          {loadError}
        </p>
      ) : html === null ? (
        <p role="status" className="py-10 text-center font-semibold">
          Loading your issue…
        </p>
      ) : (
        <div className="relative">
          <iframe
            ref={frame}
            title="Your issue as published"
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={attach}
            style={{ height }}
            className="block w-full rounded-xl bg-white ring-1 ring-ink/10"
          />
          {blocks.map((b) => {
            const done = picked.has(b.flat);
            return (
              <button
                key={b.key}
                type="button"
                style={{ left: b.left, top: b.top + 2 }}
                disabled={busy}
                aria-pressed={done}
                aria-label={`${done ? "Remove this pick" : "Pick this"}: ${b.text.slice(0, 50)}`}
                title={done ? "Picked: press to remove" : "Pick this"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // A second press takes it back out.
                  if (done) {
                    const h = highlights.find((x) => flat(x.text) === b.flat);
                    if (h) void remove(h.id);
                    return;
                  }
                  if (b.text.length > MAX_HIGHLIGHT) return setNote(`That's too long to pick whole: select up to ${MAX_HIGHLIGHT.toLocaleString("en")} characters of it instead.`);
                  void pick({ text: b.text, url: b.url, linkText: b.linkText });
                }}
                className={`group absolute z-10 grid size-7 place-items-center rounded-full shadow ${done ? "bg-honey text-ink-deep" : "bg-ink text-cream opacity-70 hover:opacity-100 focus-visible:opacity-100"}`}
              >
                {done ? (
                  <>
                    <Check aria-hidden className="size-4 group-hover:hidden group-focus-visible:hidden" strokeWidth={3} />
                    <X aria-hidden className="hidden size-4 group-hover:block group-focus-visible:block" strokeWidth={3} />
                  </>
                ) : (
                  <Plus aria-hidden className="size-4" strokeWidth={3} />
                )}
              </button>
            );
          })}
          {sel && (
            <div
              className={touch ? "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" : undefined}
              style={touch ? { bottom: "calc(var(--flowbar-h, 4.75rem) + 0.75rem)" } : undefined}
            >
              {"tooLong" in sel ? (
                <p
                  role="status"
                  style={touch ? undefined : { left: sel.left, top: floatTop(sel.top) }}
                  className={`${touch ? `${dockedStyle} pointer-events-auto` : buttonStyle} bg-surface text-ink ring-1 ring-ink/20`}
                >
                  Too long: select up to {MAX_HIGHLIGHT.toLocaleString("en")} characters
                </p>
              ) : limit ? (
                <p
                  role="status"
                  style={touch ? undefined : { left: sel.left, top: floatTop(sel.top) }}
                  className={`${touch ? `${dockedStyle} pointer-events-auto` : buttonStyle} w-max max-w-[16rem] whitespace-normal bg-coral text-center text-ink-deep`}
                >
                  {limit}
                </p>
              ) : (
                <button
                  type="button"
                  style={touch ? undefined : { left: sel.left, top: floatTop(sel.top) }}
                  className={`${touch ? `${dockedStyle} pointer-events-auto` : buttonStyle} bg-ink text-cream hover:bg-ink-deep disabled:opacity-60`}
                  onMouseDown={(e) => e.preventDefault()}
                  // A tap outside the issue can clear its selection before the click arrives, which would hide this button first.
                  // On touch the pick is made when the finger goes down; a keyboard press (detail 0) still goes through onClick.
                  onPointerDown={(e) => {
                    if (touch && e.pointerType === "touch") {
                      e.preventDefault();
                      void pick();
                    }
                  }}
                  onClick={(e) => {
                    if (!touch || e.detail === 0) void pick();
                  }}
                  disabled={busy}
                >
                  <Highlighter aria-hidden className="size-4" strokeWidth={2.25} />
                  {busy ? "Saving…" : "Pick"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

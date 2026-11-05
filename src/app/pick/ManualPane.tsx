"use client";

import { Highlighter } from "lucide-react";
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

type Selection =
  | { text: string; url: string | null; left: number; top: number }
  | { tooLong: true; left: number; top: number };

const buttonStyle =
  "absolute z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-lg";

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
  const cleanup = useRef<() => void>(() => {});

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
    const measure = () =>
      setHeight(
        Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 200),
      );
    measure();
    const ro = new ResizeObserver(measure);
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
      setSel({ text, url: a?.getAttribute("href") ?? null, left, top });
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
      ro.disconnect();
      for (const t of ["mouseup", "keyup", "touchend"])
        doc.removeEventListener(t, later);
      doc.removeEventListener("selectionchange", later);
      doc.removeEventListener("click", noLinks);
    };
  }

  async function pick() {
    if (!sel || "tooLong" in sel || busy) return;
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
        if (wordCount(sel.text) > left)
          return setNote(
            left > 0
              ? `The demo allows ${MAX_DEMO_WORDS} highlighted words in total, and you have ${left} left. Select less, or remove a highlight first.`
              : `You've used the demo's ${MAX_DEMO_WORDS} highlighted words. Remove a highlight first.`,
          );
        const id = Math.max(0, ...rows.map((r) => r.id)) + 1;
        let row = { id, text: sel.text, url: sel.url };
        let linkDropped = false;
        // Long links are what fill the cookie, so the link goes before the text does.
        if (!writeDemoRows([...rows, row])) {
          row = { ...row, url: null };
          linkDropped = Boolean(sel.url);
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
        body: JSON.stringify({ mode, text: sel.text, url: sel.url }),
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
        Select any text in the issue below, then press <strong>Pick</strong>.
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
          {sel && "tooLong" in sel && (
            <p
              role="status"
              style={{ left: sel.left, top: sel.top }}
              className={`${buttonStyle} bg-surface text-ink ring-1 ring-ink/20`}
            >
              Too long: select up to {MAX_HIGHLIGHT.toLocaleString("en")}{" "}
              characters
            </p>
          )}
          {sel && !("tooLong" in sel) && limit && (
            <p
              role="status"
              style={{ left: sel.left, top: sel.top }}
              className={`${buttonStyle} w-max max-w-[16rem] whitespace-normal bg-coral text-center text-ink-deep`}
            >
              {limit}
            </p>
          )}
          {sel && !("tooLong" in sel) && !limit && (
            <button
              type="button"
              style={{ left: sel.left, top: sel.top }}
              className={`${buttonStyle} bg-ink text-cream hover:bg-ink-deep disabled:opacity-60`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={pick}
              disabled={busy}
            >
              <Highlighter aria-hidden className="size-4" strokeWidth={2.25} />
              {busy ? "Saving…" : "Pick"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

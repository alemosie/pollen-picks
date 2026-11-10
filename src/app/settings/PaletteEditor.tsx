"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePalette } from "@/components/usePalette";
import { contrast } from "@/lib/brand";
import { bumpStyleVersion } from "@/lib/styleVersion";
import { DEFAULT_PALETTE, isHex, MAX_COLORS, MIN_COLORS, normalizeHex, parsePalette, pushPalette, resetPalette, savePalette } from "@/lib/palette";

const INK = "#2b3a36";
const CREAM = "#f7ede2";
export const textOn = (bg: string) => (contrast(bg, INK) >= contrast(bg, CREAM) ? INK : CREAM);

const field = "rounded-xl bg-surface px-3 py-2 font-mono text-sm ring-1 ring-ink/15";

/** `local`: the public demo, where there is no account; the palette stays in this browser (and travels in the demo's slide addresses). It is drawn without its own card or heading, to sit inside a window that has them. */
export function PaletteEditor({ local = false }: { local?: boolean }) {
  const saved = usePalette();
  // Raw text while typing; only valid lists are saved.
  const [mine, setMine] = useState<string[] | null>(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const colors = mine ?? saved;
  const valid = colors.every(isHex) && colors.length >= MIN_COLORS;

  // The palette is saved to the account (and kept in this browser too). Color pickers fire many changes while you drag, so the account
  // gets the result once things settle. If that fails the colors still work here, and the note says so.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const toAccount = (colors: string[] | null) => {
    if (local) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void pushPalette(colors).then((ok) => {
        if (ok) bumpStyleVersion();
        setNote(ok ? null : "Couldn't save your palette to your account. It is kept in this browser for now; change a color to try again.");
      });
    }, 600);
  };
  const update = (next: string[]) => {
    setMine(next);
    if (next.length >= MIN_COLORS && next.every(isHex)) {
      const clean = next.map((c) => c.toLowerCase());
      savePalette(clean);
      toAccount(clean);
    }
  };
  const setAt = (i: number, v: string) => update(colors.map((c, k) => (k === i ? v : c)));

  function applyPaste() {
    const found = parsePalette(paste);
    if (found.length < MIN_COLORS) {
      setNote("Couldn't find at least 2 colors. Paste a coolors.co link or hex codes like #f6bd60, #f7ede2.");
      return;
    }
    update(found);
    setPaste("");
    setNote(`Using ${found.length} colors.`);
  }

  return (
    <section id="brand-colors" className={local ? "" : "scroll-mt-6 rounded-2xl bg-card p-4 sm:p-6"}>
      {!local && <h3 className="mb-1 text-xl">Palette</h3>}
      {!local && (
        <p className="mb-5 mt-0 text-sm">
          {MIN_COLORS}–{MAX_COLORS} colors. Your slides are drawn in these, in order: background, cover and numbers, cards, labels, highlights. Text color is picked automatically so it stays readable.
        </p>
      )}
      <ul className="m-0 grid list-none gap-2 p-0">
        {colors.map((c, i) => {
          const ok = isHex(c);
          const hex = ok ? c : "#ffffff";
          return (
            <li key={i} className="flex items-center gap-2 sm:gap-3">
              <input
                type="color"
                value={hex}
                onChange={(e) => setAt(i, e.target.value)}
                aria-label={`Color ${i + 1}`}
                className="size-11 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"
              />
              <input
                value={c}
                onChange={(e) => setAt(i, e.target.value.startsWith("#") || !e.target.value ? e.target.value : `#${e.target.value}`)}
                onBlur={() => {
                  const n = normalizeHex(c);
                  if (n && n !== c) setAt(i, n);
                }}
                maxLength={7}
                spellCheck={false}
                aria-label={`Hex code for color ${i + 1}`}
                aria-invalid={!ok}
                className={`${field} w-28 min-w-0 shrink-0 sm:w-32 ${ok ? "" : "ring-2 ring-coral"}`}
              />
              <span style={{ background: hex, color: textOn(hex) }} className="grid h-11 min-w-0 flex-1 place-items-center whitespace-nowrap rounded-xl px-2 text-sm font-bold ring-1 ring-ink/15">
                {/* Phones have room for just "Aa"; wider screens get the sample line. */}
                <span className="sm:hidden">Aa</span>
                <span className="max-sm:hidden">Aa · Sample text</span>
              </span>
              <button
                type="button"
                onClick={() => update(colors.filter((_, k) => k !== i))}
                disabled={colors.length <= MIN_COLORS}
                aria-label={`Remove color ${i + 1}`}
                className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-ink/10 disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {!valid && <p className="mb-0 mt-3 text-sm font-semibold text-coral">Fix the highlighted hex code to save. Your last valid palette is still in use.</p>}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={() => update([...colors, "#ffffff"])}
          disabled={colors.length >= MAX_COLORS}
          className="inline-flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 font-bold ring-1 ring-ink/15 hover:ring-ink/40 disabled:opacity-40"
        >
          <Plus aria-hidden className="size-4" /> Add a color
        </button>
        <button
          type="button"
          onClick={() => {
            resetPalette();
            toAccount(DEFAULT_PALETTE); // saved as the standard palette, so other browsers follow the reset
            setMine(null);
            setNote("Back to the Pollen Picks colors.");
          }}
          disabled={colors.join() === DEFAULT_PALETTE.join()}
          className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
        >
          <RotateCcw aria-hidden className="size-4" /> Reset to default
        </button>
      </div>

      <div className="mt-6 border-t border-ink/15 pt-6">
        <h4 className="mb-1 text-lg">Paste a palette</h4>
        <p className="mb-4 mt-0 text-sm">
          Paste a <strong>coolors.co</strong> link, or a list of hex codes. This replaces the colors above.
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={3}
          placeholder="https://coolors.co/palette/f6bd60-f7ede2-f5cac3-84a59d-f28482"
          className={`${field} w-full font-normal`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="button" onClick={applyPaste} disabled={!paste.trim()} className="rounded-xl bg-ink px-5 py-2.5 font-bold text-cream hover:bg-ink-deep disabled:opacity-40">
            Use these colors
          </button>
          {note && (
            <span role="status" className="text-sm font-semibold">
              {note}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { usePalette } from "@/components/usePalette";
import { contrast } from "@/lib/brand";
import { DEFAULT_PALETTE, isHex, MAX_COLORS, MIN_COLORS, normalizeHex, parsePalette, resetPalette, savePalette } from "@/lib/palette";

const INK = "#2b3a36";
const CREAM = "#f7ede2";
export const textOn = (bg: string) => (contrast(bg, INK) >= contrast(bg, CREAM) ? INK : CREAM);

const field = "rounded-xl bg-surface px-3 py-2 font-mono text-sm ring-1 ring-ink/15";

export function PaletteEditor() {
  const saved = usePalette();
  // Raw text while typing; only valid lists are saved.
  const [mine, setMine] = useState<string[] | null>(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const colors = mine ?? saved;
  const valid = colors.every(isHex) && colors.length >= MIN_COLORS;

  const update = (next: string[]) => {
    setMine(next);
    if (next.length >= MIN_COLORS && next.every(isHex)) savePalette(next.map((c) => c.toLowerCase()));
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
    <div className="grid gap-8">
      <section className="rounded-2xl bg-card p-6">
        <h2 className="mb-1 text-2xl">Palette</h2>
        <p className="mb-5 mt-0 text-sm">
          {MIN_COLORS}–{MAX_COLORS} colors. Slide text switches between dark and light automatically, so it stays readable.
        </p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {colors.map((c, i) => {
            const ok = isHex(c);
            const hex = ok ? c : "#ffffff";
            return (
              <li key={i} className="flex items-center gap-3">
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
                  className={`${field} w-32 ${ok ? "" : "ring-2 ring-coral"}`}
                />
                <span style={{ background: hex, color: textOn(hex) }} className="grid h-11 min-w-0 flex-1 place-items-center rounded-xl text-sm font-bold ring-1 ring-ink/15">
                  Aa · Sample text
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
              setMine(null);
              setNote("Back to the Pollen Picks colors.");
            }}
            disabled={colors.join() === DEFAULT_PALETTE.join()}
            className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
          >
            <RotateCcw aria-hidden className="size-4" /> Reset to default
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-card p-6">
        <h2 className="mb-1 text-2xl">Paste a palette</h2>
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
      </section>
    </div>
  );
}

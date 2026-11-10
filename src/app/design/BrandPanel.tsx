"use client";

import { Pencil, X } from "lucide-react";
import { useRef } from "react";
import { PaletteEditor } from "@/app/settings/PaletteEditor";
import { usePalette } from "@/components/usePalette";
import { brandSummary, type BrandInfo } from "@/lib/brandSummary";

/** Where the brand is edited (Settings > Brand). A new tab, so the design being built here stays as it is; the slides pick the change up when it is saved. */
const EDIT = "/settings?section=brand";

/**
 * "Your brand", in the sidebar above "Fits on": the palette, logo and name the slides are drawn with, in the Standard and the Customize layout alike.
 * Before anything is set up it says the slides use the Pollen Picks colors. (On a phone the sidebar is below the slides, so it is down there with "Fits on".)
 */
export function BrandPanel({ brand, demo = false }: { brand?: BrandInfo; demo?: boolean }) {
  const b = brandSummary(usePalette(), brand);
  // The demo has no account, so there is no Settings to go to: the colors are edited right here, and kept in this browser.
  const dialog = useRef<HTMLDialogElement>(null);
  const open = () => dialog.current?.showModal();
  return (
    <aside aria-label="Your brand" className="grid content-start gap-2 text-sm">
      <div className="flex items-center gap-1">
        <p className="m-0 text-base font-semibold">Your brand</p>
        {demo ? (
          <button type="button" onClick={open} aria-label="Edit brand colors" title="Edit brand colors" className="grid size-6 place-items-center rounded-full hover:bg-ink/10">
            <Pencil aria-hidden className="size-4" />
          </button>
        ) : (
        <a
          href={EDIT}
          target="_blank"
          rel="noopener"
          aria-label="Edit brand (opens in a new tab)"
          title="Edit brand"
          className="grid size-6 place-items-center rounded-full hover:bg-ink/10"
        >
          <Pencil aria-hidden className="size-4" />
        </a>
        )}
      </div>
      <ul aria-label="Palette" className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {b.palette.map((c, i) => (
          <li key={`${c}-${i}`} title={c} style={{ background: c }} className="size-5 rounded-full ring-1 ring-ink/20">
            <span className="sr-only">{c}</span>
          </li>
        ))}
      </ul>
      {b.set ? (
        (b.logo || b.name) && (
          <div className="flex items-center gap-2">
            {b.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo} alt="" className="h-7 max-w-24 shrink-0 rounded bg-white object-contain p-px ring-1 ring-ink/15" />
            )}
            {b.name && <span className="min-w-0 font-semibold">{b.name}</span>}
          </div>
        )
      ) : (
        <p className="m-0">
          Using Pollen Picks colors.{" "}
          {demo ? (
            <button type="button" onClick={open} className="font-bold underline underline-offset-4">
              Add yours.
            </button>
          ) : (
            <a href={EDIT} target="_blank" rel="noopener" className="font-bold underline underline-offset-4">
              Add yours.
            </a>
          )}
        </p>
      )}
      {demo && (
        <dialog
          ref={dialog}
          aria-labelledby="brand-dialog-title"
          onClick={(e) => e.target === dialog.current && dialog.current?.close()}
          className="m-auto max-h-[90dvh] w-[min(34rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-ink/50 open:flex"
        >
          <header className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 pb-4 pt-5 sm:px-7">
            <div>
              <h2 id="brand-dialog-title" className="mb-1 text-2xl">Your brand colors</h2>
              <p className="m-0 text-sm">2–8 colors. Your slides are drawn in these, in order: background, cover and numbers, cards, labels, highlights. Text color is picked automatically so it stays readable.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full hover:bg-ink/10">
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <PaletteEditor local />
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-ink/10 px-5 py-4 sm:px-7">
            <p className="m-0 min-w-0 flex-1 basis-56 text-sm">Sign in to add your logo and name too, and to keep your colors on your account.</p>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-xl bg-ink px-6 py-2.5 font-bold text-cream hover:bg-ink-deep">
              Done
            </button>
          </footer>
        </dialog>
      )}
    </aside>
  );
}

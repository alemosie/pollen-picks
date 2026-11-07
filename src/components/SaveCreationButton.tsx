"use client";

import { Bookmark, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadFormat } from "@/lib/progress";
import { patchSync } from "@/lib/runSync";
import type { SavedStep } from "@/lib/savedCreationShape";

type State = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

/**
 * "Save" on the dark flow bar (Design, Write and Send): keeps this creation (the picks, the design, and the caption as Write kept it) under Saved creations
 * on the History page, for this account. Saving again replaces the earlier one for the same issue. Only text and settings are kept, never images.
 */
export function SaveCreationButton({ source, picks, template, step }: { source: string; picks: number[]; template: string; step: SavedStep }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function save() {
    if (state.kind === "saving") return;
    setState({ kind: "saving" });
    let next: State;
    try {
      // The server fills in the issue's title, newsletter and address itself; the caption only counts if it is for exactly these picks and this design.
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, picks, template, step, format: loadFormat() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; id?: string; updatedAt?: string };
      if (res.status === 401) next = { kind: "error", message: "Your Buffer login has expired. Log in again to save." };
      else if (!res.ok) next = { kind: "error", message: j.error ?? "Couldn't save right now. Try again in a moment." };
      else {
        // From now on this browser keeps this saved creation up to date as the person works (see RunAutosave).
        if (j.id && j.updatedAt) patchSync({ savedId: j.id, savedSource: source, savedUpdatedAt: j.updatedAt });
        next = { kind: "saved" };
      }
    } catch {
      next = { kind: "error", message: "Couldn't reach Pollen Picks. Check your connection and try again." };
    }
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState({ kind: "idle" }), next.kind === "saved" ? 6_000 : 8_000);
  }

  const saving = state.kind === "saving";
  const Icon = state.kind === "saved" ? Check : Bookmark;
  return (
    <span className="relative">
      <button
        type="button"
        onClick={save}
        disabled={saving}
        title="Save this creation to come back to it"
        className="inline-flex items-center gap-2 rounded-xl px-3.5 py-3 font-bold ring-1 ring-cream/40 hover:bg-cream/15 disabled:opacity-60 sm:px-4"
      >
        <Icon aria-hidden className="size-4" strokeWidth={2.5} />
        <span className="sr-only sm:not-sr-only">{saving ? "Saving…" : state.kind === "saved" ? "Saved" : "Save"}</span>
      </button>
      <span role="status" aria-live="polite" className="contents">
        {state.kind === "saved" && (
          <span className="absolute bottom-full right-0 mb-3 w-max max-w-[min(20rem,calc(100vw-3rem))] rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-cream shadow-lg ring-1 ring-cream/30">
            Saved. Find it under{" "}
            <Link href="/history#saved-creations" className="font-bold underline underline-offset-4">
              Saved creations
            </Link>{" "}
            in History.
          </span>
        )}
        {state.kind === "error" && (
          <span role="alert" className="absolute bottom-full right-0 mb-3 w-max max-w-[min(20rem,calc(100vw-3rem))] rounded-xl bg-coral px-3.5 py-2 text-xs font-semibold text-ink-deep shadow-lg">
            {state.message}
          </span>
        )}
      </span>
    </span>
  );
}

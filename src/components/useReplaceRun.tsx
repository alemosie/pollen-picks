"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PollenSpinner } from "@/components/PollenSpinner";
import { forgetRun } from "@/lib/runSync";

type Status = { run: { source: string; newsletter: string; title: string; picks: number; step: number } | null; unsaved: boolean; hasSavedForIssue: boolean };
type Pending = { status: Status; go: () => void; intoSource?: string };

/**
 * Throws away the current run on the server and what this browser knew about it. Throws if the server did not confirm: a run that is still there would
 * come back (a "doesn't match this screen" question on the next autosave, and "load the saved run" would bring the old picks back), so the caller must
 * not go on as if it were gone. The browser keeps what it knew about the run in that case, so a later autosave still matches it.
 */
async function discardRun() {
  const res = await fetch("/api/run", { method: "DELETE" });
  if (!res.ok) throw new Error(`discarding the run failed (${res.status})`);
  forgetRun();
}

/**
 * Anything that replaces the current run (opening a saved creation, choosing a new source, "Start over") goes through `guard`. If the run holds work that
 * no saved creation holds, the person is asked first: save it, or discard it for good. Otherwise the run is replaced without a question.
 * `intoSource` is the issue being opened (a saved creation of the same issue as an unsaved run can't be a place to save that run first).
 * Render `dialog` somewhere in the component.
 */
export function useReplaceRun(): { guard: (go: () => void, opts?: { intoSource?: string }) => Promise<void>; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);

  const guard = useCallback(async (go: () => void, opts?: { intoSource?: string }) => {
    let status: Status | null = null;
    try {
      const res = await fetch("/api/run", { cache: "no-store" });
      if (res.ok) status = (await res.json()) as Status;
    } catch {}
    if (!status?.run || !status.unsaved) {
      // Nothing is lost if this fails (the run is saved, or there is none): go on, and the browser still remembers the run it knew, so autosave matches it.
      await discardRun().catch(() => {});
      go();
      return;
    }
    setError("");
    setPending({ status, go, intoSource: opts?.intoSource });
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pending && !d.open) d.showModal();
    if (!pending && d.open) d.close();
  }, [pending]);

  async function proceed(save: boolean) {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      if (save) {
        const res = await fetch("/api/run/save", { method: "POST" });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? "Couldn't save it right now. Your run is still there. Try again in a moment.");
          return;
        }
      }
      await discardRun();
      const go = pending.go;
      setPending(null);
      go();
    } catch {
      setError("Couldn't discard it right now. Your run is still there. Check your connection and try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const run = pending?.status.run;
  const sameIssue = Boolean(run && pending?.intoSource && run.source === pending.intoSource);
  const name = run?.title || run?.newsletter || "your current run";
  const dialog = (
    <dialog
      ref={ref}
      onClose={() => setPending(null)}
      aria-labelledby="replace-run-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-cream p-6 text-ink backdrop:bg-ink/50"
    >
      {pending && run && (
        <div className="grid gap-3">
          <h2 id="replace-run-title" className="m-0 text-2xl">
            {sameIssue ? "Discard your changes?" : "Your current run isn't saved"}
          </h2>
          <p className="m-0 text-sm">
            {sameIssue
              ? `You have changes to "${name}" that aren't saved. Opening the saved version discards them, and they can't be brought back.`
              : `"${name}" (${run.picks} ${run.picks === 1 ? "pick" : "picks"}) isn't saved anywhere. Going on replaces it. Save it first, or discard it for good.`}
          </p>
          {!sameIssue && pending.status.hasSavedForIssue && <p className="m-0 text-xs font-semibold">Saving it replaces the saved creation you already have for this issue.</p>}
          {error && (
            <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
              {error}
            </p>
          )}
          <span className="flex flex-wrap gap-2">
            {!sameIssue && (
              <button type="button" onClick={() => proceed(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-honey px-4 py-2 text-sm font-bold text-ink-deep hover:brightness-95 disabled:opacity-60">
                {busy && <PollenSpinner className="size-4" />}
                Save it first
              </button>
            )}
            <button type="button" onClick={() => proceed(false)} disabled={busy} className="rounded-lg bg-coral px-4 py-2 text-sm font-bold text-ink-deep hover:brightness-95 disabled:opacity-60">
              Discard it for good
            </button>
            <button type="button" onClick={() => setPending(null)} disabled={busy} className="rounded-lg bg-surface px-4 py-2 text-sm font-bold ring-1 ring-ink/20 hover:ring-ink/40 disabled:opacity-60">
              Cancel
            </button>
          </span>
        </div>
      )}
    </dialog>
  );
  return { guard, dialog };
}

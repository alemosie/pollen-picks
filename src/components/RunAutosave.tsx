"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadFormat, SAVED_EVENT } from "@/lib/progress";
import { applyOpened, loadSync, openedUrl, patchSync } from "@/lib/runSync";
import type { OpenedCreation, RunStep } from "@/lib/savedCreationShape";

/** How long after the last change the run is written (typing in a caption changes it on every key). */
const DEBOUNCE_MS = 2_000;

type Problem = { kind: "run" | "saved"; at: string | null } | { kind: "deleted" } | null;

const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : null);
/** When the server's copy was last saved, from a 409's body. */
const savedAt = async (res: Response) => ((await res.json().catch(() => ({}))) as { serverUpdatedAt?: string }).serverUpdatedAt ?? null;

/**
 * Autosave of the current run, and of the saved creation this browser keeps up to date (if the person saved this issue). Renders nothing unless
 * something needs the person's say: the saved run no longer matches this screen ("use this screen" or "load the saved run"), or the saved creation was deleted.
 * Writes happen only from this page, after a change (no background work), and on leaving the page. The server only updates what it knows: a deleted
 * saved creation is never brought back, and a write that didn't see the stored copy's latest change is refused (409) instead of overwriting it, unless it holds exactly what is stored.
 */
export function RunAutosave({ source, picks, template, step, enabled = true }: { source: string; picks: number[]; template: string; step: RunStep; enabled?: boolean }) {
  const latest = useRef({ source, picks, template, step, enabled });
  // What the timer reads when it fires: kept current after every render (never during one).
  useEffect(() => {
    latest.current = { source, picks, template, step, enabled };
  });
  const pushRef = useRef<(force?: { run?: boolean; saved?: boolean }, keepalive?: boolean) => Promise<void>>(async () => {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);
  const busy = useRef(false);
  const again = useRef(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void pushRef.current();
    }, DEBOUNCE_MS);
  }, []);

  const push = useCallback(
    async (force?: { run?: boolean; saved?: boolean }, keepalive = false) => {
      const cur = latest.current;
      if (!cur.enabled || stopped.current || cur.picks.length === 0) return;
      if (busy.current) {
        again.current = true;
        return;
      }
      busy.current = true;
      try {
        const base = { source: cur.source, picks: cur.picks, template: cur.template, format: loadFormat() };
        const sync = loadSync();
        const saved = sync.savedId && sync.savedSource === cur.source ? sync : null;
        const res = await fetch("/api/run", {
          method: "PUT",
          keepalive,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, step: cur.step, ifUpdatedAt: sync.runUpdatedAt ?? null, force: force?.run === true, savedId: saved?.savedId ?? null }),
        });
        // Logged out, or this source can't be kept (a sample issue, "the newest issue"): stop quietly, nothing to ask the person.
        if (res.status === 401 || res.status === 400 || res.status === 404) {
          stopped.current = true;
          return;
        }
        if (res.status === 409) {
          stopped.current = true;
          setProblem({ kind: "run", at: await savedAt(res) });
          return;
        }
        // A hiccup (server busy, offline): the next change writes it again.
        if (!res.ok) return;
        const j = (await res.json().catch(() => ({}))) as { updatedAt?: string };
        if (j.updatedAt) patchSync({ runUpdatedAt: j.updatedAt });
        if (saved) {
          // A saved creation has no Pick step: a run still at Pick keeps it at Design.
          const r2 = await fetch(`/api/saved/${saved.savedId}`, {
            method: "PATCH",
            keepalive,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...base, step: Math.max(3, cur.step), ifUpdatedAt: saved.savedUpdatedAt ?? null, force: force?.saved === true }),
          });
          if (r2.status === 404) {
            patchSync({ savedId: undefined, savedSource: undefined, savedUpdatedAt: undefined });
            setProblem({ kind: "deleted" });
          } else if (r2.status === 409) {
            stopped.current = true;
            setProblem({ kind: "saved", at: await savedAt(r2) });
          } else if (r2.ok) {
            const j2 = (await r2.json().catch(() => ({}))) as { updatedAt?: string };
            if (j2.updatedAt) patchSync({ savedUpdatedAt: j2.updatedAt });
          }
        }
      } catch {
        // offline: the next change writes it again
      } finally {
        busy.current = false;
        if (again.current) {
          again.current = false;
          schedule();
        }
      }
    },
    [schedule],
  );
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  // A change to the picks, the design or the step, and (through the browser's own save) to the caption, is written a moment later.
  const key = `${source}|${picks.join(",")}|${template}|${step}|${enabled}`;
  useEffect(() => {
    if (enabled) schedule();
  }, [key, enabled, schedule]);
  useEffect(() => {
    const on = () => {
      if (latest.current.enabled) schedule();
    };
    window.addEventListener(SAVED_EVENT, on);
    // Leaving the page with a write still waiting: send it now (keepalive lets it finish after the page is gone).
    const leave = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void push(undefined, true);
      }
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener(SAVED_EVENT, on);
      window.removeEventListener("pagehide", leave);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule, push]);

  async function keepMine() {
    if (!problem || problem.kind === "deleted") return;
    const kind = problem.kind;
    setProblem(null);
    setError("");
    stopped.current = false;
    await push(kind === "run" ? { run: true } : { saved: true });
  }

  async function loadTheirs() {
    if (!problem || problem.kind === "deleted") return;
    setWorking(true);
    setError("");
    try {
      const sync = loadSync();
      const res = await fetch(problem.kind === "run" ? "/api/run?open=1" : `/api/saved/${sync.savedId}`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { creation?: OpenedCreation; error?: string };
      if (!res.ok || !j.creation) setError(j.error ?? "Couldn't load it right now. Try again in a moment.");
      else {
        // A saved creation replaces this browser's run, so the server's run slot goes too (as when one is opened from History): left behind, the next
        // autosave would be refused for not matching it, and the person would be asked the same question again right after answering it.
        if (problem.kind === "saved") {
          const d = await fetch("/api/run", { method: "DELETE" }).catch(() => null);
          if (!d?.ok) {
            setError("Couldn't load it right now. Try again in a moment.");
            setWorking(false);
            return;
          }
        }
        applyOpened(j.creation, problem.kind === "run" ? "run" : "saved");
        // A full load, so every step reads the run that was just put back.
        window.location.assign(openedUrl(j.creation));
        return;
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    }
    setWorking(false);
  }

  if (!problem) return null;
  const btn = "rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-60";
  return (
    <div role="alert" className="mb-6 grid gap-2 rounded-2xl bg-honey/40 p-4 text-sm">
      <p className="m-0 font-semibold">
        {problem.kind === "run"
          ? `The run saved${when(problem.at) ? ` on ${when(problem.at)}` : ""} doesn't match what's on this screen. Autosave is paused until you choose.`
          : problem.kind === "saved"
            ? `The saved creation${when(problem.at) ? ` from ${when(problem.at)}` : ""} doesn't match what's on this screen. Autosave to it is paused until you choose.`
            : "The saved creation for this issue was deleted, so it isn't kept up to date any more. Your run still is. Press Save to keep it again."}
      </p>
      {problem.kind !== "deleted" && (
        <p className="m-0 text-xs">
          <b>Use this screen</b> overwrites the saved {problem.kind === "run" ? "run" : "creation"}. <b>Load the saved {problem.kind === "run" ? "run" : "creation"}</b> replaces what&rsquo;s on this screen with it.
        </p>
      )}
      {error && <p className="m-0 font-semibold text-coral">{error}</p>}
      <span className="flex flex-wrap gap-2">
        {problem.kind === "deleted" ? (
          <button type="button" onClick={() => setProblem(null)} className={`${btn} bg-surface ring-1 ring-ink/20 hover:ring-ink/40`}>
            Got it
          </button>
        ) : (
          <>
            <button type="button" onClick={keepMine} disabled={working} className={`${btn} bg-honey text-ink-deep hover:brightness-95`}>
              Use this screen
            </button>
            <button type="button" onClick={loadTheirs} disabled={working} className={`${btn} bg-surface ring-1 ring-ink/20 hover:ring-ink/40`}>
              Load the saved {problem.kind === "run" ? "run" : "creation"}
            </button>
          </>
        )}
      </span>
    </div>
  );
}
